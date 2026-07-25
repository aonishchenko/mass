/**
 * The 0G Storage SDK reaches the indexer through `open-jsonrpc-provider`, which
 * depends on axios 0.27. That version chooses between an XHR adapter and a Node
 * `http` adapter at import time — Workers has neither, so any call fails with
 * "adapter is not a function".
 *
 * axios only gained a native fetch adapter in 1.7, so we supply one. Install it
 * BEFORE the SDK is imported (see storage.ts) or the SDK's axios instance will
 * have already captured the broken default.
 */

interface AxiosLikeConfig {
  url?: string;
  baseURL?: string;
  method?: string;
  data?: unknown;
  headers?: Record<string, string>;
  responseType?: string;
  params?: Record<string, string>;
}

interface AxiosLikeResponse {
  data: unknown;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: AxiosLikeConfig;
  request: null;
}

function buildUrl(config: AxiosLikeConfig): string {
  const base = config.baseURL ?? "";
  const path = config.url ?? "";
  const url = /^https?:\/\//i.test(path) ? path : `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
  if (!config.params) return url;
  const qs = new URLSearchParams(config.params).toString();
  return qs ? `${url}${url.includes("?") ? "&" : "?"}${qs}` : url;
}

export async function fetchAdapter(config: AxiosLikeConfig): Promise<AxiosLikeResponse> {
  const url = buildUrl(config);
  const method = (config.method ?? "get").toUpperCase();

  const headers: Record<string, string> = { ...(config.headers ?? {}) };
  // axios 0.27 leaves these in for GETs, where they are invalid.
  if (method === "GET" || method === "HEAD") delete headers["Content-Type"];

  let body: string | undefined;
  if (config.data !== undefined && method !== "GET" && method !== "HEAD") {
    body = typeof config.data === "string" ? config.data : JSON.stringify(config.data);
    headers["Content-Type"] ??= "application/json";
  }

  const res = await fetch(url, { method, headers, body });

  let data: unknown;
  if (config.responseType === "arraybuffer") {
    data = await res.arrayBuffer();
  } else {
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  const outHeaders: Record<string, string> = {};
  res.headers.forEach((v, k) => (outHeaders[k] = v));

  return {
    data,
    status: res.status,
    statusText: res.statusText,
    headers: outHeaders,
    config,
    request: null,
  };
}

let installed = false;

/** Idempotent: patch the shared axios default adapter. */
export async function installFetchAdapter(): Promise<void> {
  if (installed) return;
  const axios = (await import("axios")).default as unknown as {
    defaults: { adapter?: unknown };
  };
  axios.defaults.adapter = fetchAdapter as unknown as never;
  installed = true;
}
