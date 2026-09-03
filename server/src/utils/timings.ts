import mongoose from "mongoose";
import { recordSpan } from "./requestContext";

/**
 * Time attribution: how much of a request's latency was Mongo, how much was a
 * third-party HTTP call, and how much was our own code.
 *
 * Everything here patches **prototypes**, not instances or global config. That
 * is deliberate:
 *
 *  - `mongoose.plugin()` only applies to schemas compiled *after* the call, so
 *    it would silently miss every model already imported — and model imports
 *    are scattered across the app, making the ordering impossible to guarantee.
 *  - The driver's command-monitoring events (`monitorCommands`) fire on the
 *    connection's emitter, which is a *different* async context from the
 *    request that issued the query. `AsyncLocalStorage` would return the wrong
 *    request, or none at all.
 *  - Axios interceptors registered on the default export do not apply to
 *    instances built with `axios.create()` — and the one real axios consumer
 *    here (`AitaRankingSource`) uses exactly that.
 *
 * Patching the prototype sidesteps all three: the wrapper runs synchronously
 * inside the caller's async context, so the span lands on the right request.
 */

let installed = false;

const elapsedMs = (start: bigint): number => Number(process.hrtime.bigint() - start) / 1e6;

/** Wrap a promise-returning method so its duration is attributed on settle. */
const timeAround = <T>(kind: "db" | "ext", run: () => Promise<T>): Promise<T> => {
  const start = process.hrtime.bigint();
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    recordSpan(kind, elapsedMs(start));
  };

  try {
    return run().then(
      (value) => {
        finish();
        return value;
      },
      (error) => {
        // A failed call still consumed wall-clock — arguably the most
        // interesting kind, since timeouts are the slow ones.
        finish();
        throw error;
      }
    );
  } catch (error) {
    finish();
    throw error;
  }
};

const patchMongoose = (): void => {
  const queryProto = mongoose.Query.prototype as unknown as {
    exec: (...args: unknown[]) => Promise<unknown>;
    __pmsTimed?: boolean;
  };
  if (!queryProto.__pmsTimed) {
    const original = queryProto.exec;
    queryProto.exec = function patchedExec(...args: unknown[]) {
      return timeAround("db", () => original.apply(this, args));
    };
    queryProto.__pmsTimed = true;
  }

  const aggregateProto = mongoose.Aggregate.prototype as unknown as {
    exec: (...args: unknown[]) => Promise<unknown>;
    __pmsTimed?: boolean;
  };
  if (!aggregateProto.__pmsTimed) {
    const original = aggregateProto.exec;
    aggregateProto.exec = function patchedExec(...args: unknown[]) {
      return timeAround("db", () => original.apply(this, args));
    };
    aggregateProto.__pmsTimed = true;
  }

  const modelProto = mongoose.Model.prototype as unknown as {
    save: (...args: unknown[]) => Promise<unknown>;
    __pmsTimed?: boolean;
  };
  if (!modelProto.__pmsTimed) {
    const original = modelProto.save;
    modelProto.save = function patchedSave(...args: unknown[]) {
      return timeAround("db", () => original.apply(this, args));
    };
    modelProto.__pmsTimed = true;
  }
};

const patchFetch = (): void => {
  const current = globalThis.fetch;
  if (typeof current !== "function") return;
  if ((current as { __pmsTimed?: boolean }).__pmsTimed) return;

  const patched = function patchedFetch(
    ...args: Parameters<typeof fetch>
  ): ReturnType<typeof fetch> {
    return timeAround("ext", () => current(...args));
  };
  (patched as { __pmsTimed?: boolean }).__pmsTimed = true;
  globalThis.fetch = patched as typeof fetch;
};

const patchAxios = (): void => {
  // Required lazily so a missing/optional axios never breaks boot.
  let axios: typeof import("axios").default;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    axios = require("axios");
  } catch {
    return;
  }

  const proto = (axios as unknown as { Axios?: { prototype: Record<string, unknown> } }).Axios
    ?.prototype;
  if (!proto) return;
  if ((proto as { __pmsTimed?: boolean }).__pmsTimed) return;

  const original = proto.request as (...args: unknown[]) => Promise<unknown>;
  if (typeof original !== "function") return;

  proto.request = function patchedRequest(...args: unknown[]) {
    return timeAround("ext", () => original.apply(this, args));
  };
  (proto as { __pmsTimed?: boolean }).__pmsTimed = true;
};

/**
 * Install all instrumentation. Idempotent, and safe to call before or after
 * models are compiled and connections opened.
 */
export const installTimingInstrumentation = (): void => {
  if (installed) return;
  installed = true;

  patchMongoose();
  patchFetch();
  patchAxios();
};
