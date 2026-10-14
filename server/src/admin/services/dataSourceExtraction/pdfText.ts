import { Worker } from "node:worker_threads";

import { log as __rootLog } from "../../../utils/logger";

const log = __rootLog.child("pdf-text");

// ─── The text of a PDF, so the quotes read from it can be checked ───────────
//
// A model reads a PDF as the document it looks like, tables and scans included.
// To check that a quote it gives is really in the PDF we need the PDF's text
// layer, which this extracts. It is only ever used to check a quote against, never
// to feed the model, which reads the PDF itself.
//
// ── Why a worker thread ──
// A PDF is a file from someone else's site, parsed by a large library on the same
// thread as every request the server is handling. A malformed or malicious one can
// loop for ever or eat memory. So parsing runs in a worker with a memory ceiling
// and a hard timeout: the worst a bad PDF can do is yield no text.
//
// ── What this cannot read ──
// A scanned PDF has no text layer (the model reads those by sight, so extraction
// still works for them, but there is nothing here to check against), and a table
// or a two-column page can come out in a different order from how it reads. A quote
// that is really there can therefore fail to match; the caller treats a PDF
// verdict as weaker than one against a web page, and never as grounds to untick.

export interface PdfText {
  text: string;
  /** Pages in the document. */
  pages: number;
  /** Pages whose text was read: fewer than `pages` when the document is long. */
  pagesRead: number;
}

const TIMEOUT_MS = 30_000;
const MAX_PAGES = 100;
const MAX_CHARS = 300_000;
const MEMORY_MB = 384;
/** Text shorter than this is a scan or a cover sheet, with nothing worth comparing a quote with. */
export const MIN_USEFUL_CHARS = 200;

// Runs inside the worker. Kept as a string so it needs no file of its own, and so
// it works the same from compiled output and from ts-node. `eval: true` workers
// resolve `require` from the working directory, so the library's absolute path is
// passed in rather than looked up there.
const WORKER_SOURCE = `
const { parentPort, workerData } = require("node:worker_threads");
(async () => {
  try {
    const { getDocumentProxy } = require(workerData.unpdfPath);
    const pdf = await getDocumentProxy(new Uint8Array(workerData.data), {
      isEvalSupported: false,
      useSystemFonts: false,
      disableFontFace: true,
      verbosity: 0,
    });
    const pages = pdf.numPages;
    const limit = Math.min(pages, workerData.maxPages);
    let text = "";
    let pagesRead = 0;
    for (let n = 1; n <= limit && text.length < workerData.maxChars; n += 1) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      for (const item of content.items) {
        if (typeof item.str === "string") text += item.str + (item.hasEOL ? "\\n" : "");
      }
      text += "\\n";
      pagesRead += 1;
      page.cleanup();
    }
    // No pdf.destroy(): this version has none, and the worker is terminated as
    // soon as it has answered, which frees everything it held.
    parentPort.postMessage({ ok: true, text: text.slice(0, workerData.maxChars), pages, pagesRead });
  } catch (error) {
    parentPort.postMessage({ ok: false, reason: String((error && error.name) || "Error") });
  }
})();
`;

/**
 * The text of a PDF's text layer, or null when there is none worth using: it
 * could not be parsed, is encrypted, took too long, or is a scan.
 */
export async function extractPdfText(
  buffer: Buffer,
  options: { timeoutMs?: number; maxPages?: number } = {}
): Promise<PdfText | null> {
  // A copy the worker can own: a Buffer may be a view onto a shared pool.
  const data = new Uint8Array(buffer.byteLength);
  data.set(buffer);

  return new Promise<PdfText | null>((resolve) => {
    let settled = false;
    const finish = (value: PdfText | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      resolve(value);
    };

    const worker = new Worker(WORKER_SOURCE, {
      eval: true,
      workerData: {
        unpdfPath: require.resolve("unpdf"),
        data: data.buffer,
        maxPages: options.maxPages ?? MAX_PAGES,
        maxChars: MAX_CHARS,
      },
      transferList: [data.buffer],
      resourceLimits: { maxOldGenerationSizeMb: MEMORY_MB, maxYoungGenerationSizeMb: 32 },
    });

    const timer = setTimeout(() => {
      log.warn("Reading a PDF's text took too long; giving up on it.");
      finish(null);
    }, options.timeoutMs ?? TIMEOUT_MS);

    worker.on(
      "message",
      (message: {
        ok: boolean;
        text?: string;
        pages?: number;
        pagesRead?: number;
        reason?: string;
      }) => {
        if (!message.ok) {
          log.warn(`A PDF's text could not be read (${message.reason ?? "unknown"}).`);
          return finish(null);
        }
        const text = message.text ?? "";
        if (text.replace(/\s+/g, "").length < MIN_USEFUL_CHARS) return finish(null);
        finish({ text, pages: message.pages ?? 0, pagesRead: message.pagesRead ?? 0 });
      }
    );
    // A worker that runs out of memory or crashes ends here, not in the server.
    worker.on("error", (error: Error) => {
      log.warn(`The PDF reader stopped (${String(error.message).slice(0, 100)}).`);
      finish(null);
    });
    worker.on("exit", () => finish(null));
  });
}
