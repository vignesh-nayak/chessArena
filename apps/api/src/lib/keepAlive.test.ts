import assert from "node:assert/strict";
import { afterEach, describe, it, jest } from "@jest/globals";
import {
  KEEP_ALIVE_INTERVAL_MS,
  KEEP_ALIVE_RETRY_MS,
  keepAliveUrl,
  startKeepAlive,
  type KeepAliveFetch,
} from "./keepAlive.js";

const origin = "https://chessarena-server-uzin.onrender.com";

describe("keepAliveUrl", () => {
  it("appends /api/health and drops one trailing slash", () => {
    assert.equal(keepAliveUrl(origin), `${origin}/api/health`);
    assert.equal(keepAliveUrl(`${origin}/`), `${origin}/api/health`);
  });
});

describe("startKeepAlive", () => {
  const stops: Array<() => void> = [];

  afterEach(() => {
    for (const stop of stops) stop();
    stops.length = 0;
    jest.useRealTimers();
  });

  function silence() {
    return {
      info: () => {},
      error: () => {},
    };
  }

  it("does not fetch when the origin is missing", async () => {
    jest.useFakeTimers();
    let fetches = 0;
    const fetchImpl: KeepAliveFetch = async () => {
      fetches += 1;
      return { ok: true, status: 200 };
    };
    const lines: string[] = [];
    const log = {
      info: (message: string) => lines.push(message),
      error: (message: string) => lines.push(message),
    };

    stops.push(startKeepAlive({ origin: undefined, fetchImpl, log }));
    stops.push(startKeepAlive({ origin: "  ", fetchImpl, log }));
    await jest.advanceTimersByTimeAsync(KEEP_ALIVE_INTERVAL_MS);

    assert.equal(fetches, 0);
    assert.deepEqual(lines, [
      "[api] Keep-alive skipped: RENDER_EXTERNAL_URL is not set",
      "[api] Keep-alive skipped: RENDER_EXTERNAL_URL is not set",
    ]);
  });

  it("pings the public health URL after 12 minutes", async () => {
    jest.useFakeTimers();
    const calls: Array<{ url: string; hasSignal: boolean }> = [];
    const lines: string[] = [];
    stops.push(
      startKeepAlive({
        origin: `${origin}/`,
        fetchImpl: async (url, init) => {
          calls.push({ url, hasSignal: init.signal instanceof AbortSignal });
          return { ok: true, status: 200 };
        },
        log: {
          info: (message) => lines.push(message),
          error: (message) => lines.push(message),
        },
      }),
    );

    assert.equal(calls.length, 0);
    await jest.advanceTimersByTimeAsync(KEEP_ALIVE_INTERVAL_MS - 1);
    assert.equal(calls.length, 0);
    await jest.advanceTimersByTimeAsync(1);

    assert.deepEqual(calls, [
      { url: `${origin}/api/health`, hasSignal: true },
    ]);
    assert.deepEqual(lines, ["[api] Keep-alive ping 200"]);
  });

  it("retries a failed ping once after 30 seconds", async () => {
    jest.useFakeTimers();
    let attempts = 0;
    const lines: string[] = [];
    stops.push(
      startKeepAlive({
        origin,
        fetchImpl: async () => {
          attempts += 1;
          if (attempts === 1) return { ok: false, status: 503 };
          return { ok: true, status: 200 };
        },
        log: {
          info: (message) => lines.push(message),
          error: (message) => lines.push(message),
        },
      }),
    );

    await jest.advanceTimersByTimeAsync(KEEP_ALIVE_INTERVAL_MS);
    assert.equal(attempts, 1);
    await jest.advanceTimersByTimeAsync(KEEP_ALIVE_RETRY_MS - 1);
    assert.equal(attempts, 1);
    await jest.advanceTimersByTimeAsync(1);

    assert.equal(attempts, 2);
    assert.deepEqual(lines, [
      "[api] Keep-alive ping failed: HTTP 503",
      "[api] Keep-alive ping 200",
    ]);
  });

  it("does not schedule a second retry", async () => {
    jest.useFakeTimers();
    let attempts = 0;
    const lines: string[] = [];
    stops.push(
      startKeepAlive({
        origin,
        fetchImpl: async () => {
          attempts += 1;
          throw new Error("network down");
        },
        log: {
          info: (message) => lines.push(message),
          error: (message) => lines.push(message),
        },
      }),
    );

    await jest.advanceTimersByTimeAsync(KEEP_ALIVE_INTERVAL_MS);
    assert.equal(attempts, 1);
    await jest.advanceTimersByTimeAsync(KEEP_ALIVE_RETRY_MS);
    assert.equal(attempts, 2);
    await jest.advanceTimersByTimeAsync(KEEP_ALIVE_RETRY_MS);

    assert.equal(attempts, 2);
    assert.deepEqual(lines, [
      "[api] Keep-alive ping failed: network down",
      "[api] Keep-alive ping failed: network down",
    ]);
  });

  it("cancels a pending retry when the next interval fires", async () => {
    jest.useFakeTimers();
    let attempts = 0;
    const intervalMs = 20_000;
    stops.push(
      startKeepAlive({
        origin,
        intervalMs,
        fetchImpl: async () => {
          attempts += 1;
          throw new Error("network down");
        },
        log: silence(),
      }),
    );

    await jest.advanceTimersByTimeAsync(intervalMs);
    assert.equal(attempts, 1);
    await jest.advanceTimersByTimeAsync(intervalMs);
    assert.equal(attempts, 2);
    await jest.advanceTimersByTimeAsync(KEEP_ALIVE_RETRY_MS - intervalMs);

    assert.equal(attempts, 2);
  });
});
