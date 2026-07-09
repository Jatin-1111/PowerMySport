import * as chromeLauncher from "chrome-launcher";

const url = process.argv[2];
if (!url) {
  console.error("usage: node cls-probe.mjs <url>");
  process.exit(1);
}

let nextId = 1;
function send(ws, method, params = {}) {
  const id = nextId++;
  return new Promise((resolve) => {
    const handler = (event) => {
      const msg = JSON.parse(event.data.toString());
      if (msg.id === id) {
        ws.removeEventListener("message", handler);
        resolve(msg.result);
      }
    };
    ws.addEventListener("message", handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function main() {
  const chrome = await chromeLauncher.launch({
    chromeFlags: ["--headless=new", "--disable-gpu", "--no-sandbox", "--window-size=1350,940"],
  });

  const res = await fetch(`http://localhost:${chrome.port}/json/new?about:blank`, {
    method: "PUT",
  });
  const target = await res.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.addEventListener("open", resolve));

  await send(ws, "Runtime.enable");
  await send(ws, "Page.enable");
  await send(ws, "Network.enable");
  // Simulate a throttled mobile-ish connection (matches Lighthouse's desktopDense4G-ish conditions)
  await send(ws, "Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (10 * 1024 * 1024) / 8,
    uploadThroughput: (5 * 1024 * 1024) / 8,
  });
  await send(ws, "Emulation.setCPUThrottlingRate", { rate: 4 });

  await send(ws, "Page.navigate", { url });
  await new Promise((r) => setTimeout(r, 500));

  const installResult = await send(ws, "Runtime.evaluate", {
    expression: `
      window.__shifts = [];
      window.__po = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__shifts.push({
            value: entry.value,
            time: entry.startTime,
            hadRecentInput: entry.hadRecentInput,
            sources: (entry.sources || []).map(s => ({
              node: s.node ? (s.node.tagName + (s.node.className ? '.' + String(s.node.className).slice(0,60) : '') + (s.node.id ? '#'+s.node.id : '')) : null,
              previousRect: s.previousRect,
              currentRect: s.currentRect,
            })),
          });
        }
      });
      window.__po.observe({type: 'layout-shift', buffered: true});
      'observer installed';
    `,
  });
  console.error("install result:", JSON.stringify(installResult));

  await new Promise((r) => setTimeout(r, 8000));

  const readyState = await send(ws, "Runtime.evaluate", {
    expression: "document.readyState + ' ' + location.href",
    returnByValue: true,
  });
  console.error("page state:", JSON.stringify(readyState && readyState.result));

  const result = await send(ws, "Runtime.evaluate", {
    expression: "JSON.stringify(window.__shifts || [])",
    returnByValue: true,
  });

  if (!result || !result.result || result.result.value === undefined) {
    console.error("evaluate failed:", JSON.stringify(result));
    ws.close();
    await chrome.kill().catch(() => {});
    return;
  }

  const shifts = JSON.parse(result.result.value);
  console.log(`Captured ${shifts.length} layout-shift entries for ${url}\n`);
  shifts
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
    .forEach((s, i) => {
      console.log(`#${i + 1} value=${s.value.toFixed(4)} time=${s.time.toFixed(0)}ms hadRecentInput=${s.hadRecentInput}`);
      s.sources.forEach((src) => {
        console.log(
          `   ${src.node} | prevRect top=${src.previousRect.top.toFixed(0)} h=${src.previousRect.height.toFixed(0)} -> currRect top=${src.currentRect.top.toFixed(0)} h=${src.currentRect.height.toFixed(0)}`
        );
      });
    });

  ws.close();
  await chrome.kill().catch(() => {});
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
