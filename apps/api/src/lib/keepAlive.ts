export const KEEP_ALIVE_INTERVAL_MS = 12 * 60 * 1000;
export const KEEP_ALIVE_RETRY_MS = 30 * 1000;
const KEEP_ALIVE_TIMEOUT_MS = 15 * 1000;

export function keepAliveUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/health`;
}

export type KeepAliveFetch = (
  url: string,
  init: { signal: AbortSignal },
) => Promise<{ ok: boolean; status: number }>;

type KeepAliveLog = {
  info: (message: string) => void;
  error: (message: string) => void;
};

const defaultLog: KeepAliveLog = {
  info: (message) => console.log(message),
  error: (message) => console.error(message),
};

export function startKeepAlive(options: {
  origin: string | undefined;
  intervalMs?: number;
  fetchImpl?: KeepAliveFetch;
  log?: KeepAliveLog;
}): () => void {
  const log = options.log ?? defaultLog;
  const origin = options.origin?.trim() ?? "";
  if (!origin) {
    log.info("[api] Keep-alive skipped: RENDER_EXTERNAL_URL is not set");
    return () => {};
  }

  const url = keepAliveUrl(origin);
  const intervalMs = options.intervalMs ?? KEEP_ALIVE_INTERVAL_MS;
  const fetchImpl =
    options.fetchImpl ?? ((target, init) => fetch(target, init));

  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let inFlight = false;

  function cancelRetry(): void {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  }

  async function ping(isRetry: boolean): Promise<void> {
    if (stopped || inFlight) return;
    inFlight = true;
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      KEEP_ALIVE_TIMEOUT_MS,
    );
    try {
      const response = await fetchImpl(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      log.info(`[api] Keep-alive ping ${response.status}`);
    } catch (err) {
      const message = controller.signal.aborted
        ? "timed out"
        : err instanceof Error
          ? err.message
          : String(err);
      log.error(`[api] Keep-alive ping failed: ${message}`);
      if (!isRetry && !stopped) {
        cancelRetry();
        retryTimer = setTimeout(() => {
          retryTimer = null;
          void ping(true);
        }, KEEP_ALIVE_RETRY_MS);
      }
    } finally {
      clearTimeout(timeout);
      inFlight = false;
    }
  }

  const interval = setInterval(() => {
    cancelRetry();
    void ping(false);
  }, intervalMs);

  return () => {
    stopped = true;
    clearInterval(interval);
    cancelRetry();
  };
}
