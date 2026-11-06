export interface ApiCall {
  method: string;
  path: string;
  body: unknown;
  /** The full URL as requested, including host and query string. */
  url: string;
  headers: Record<string, string>;
}

type Reply = unknown | ((call: ApiCall) => unknown);

export interface MockApi {
  /** Requests to the app's own `/api/*` routes. */
  calls: ApiCall[];
  /** Every request, including external services (EPA, Mapbox, EIA), for checking URLs and params. */
  all: ApiCall[];
  /** Full URLs of requests whose host+path start with the given prefix, as URL objects for param checks. */
  urlsTo: (prefix: string) => URL[];
  /** Calls whose "METHOD /path" starts with the given prefix, e.g. callsTo('POST /api/trips'). */
  callsTo: (prefix: string) => ApiCall[];
}

/** A reply that makes the fetch fail like a server error. */
export class ApiError {
  constructor(public status = 500) {}
}

/** A reply returned verbatim as the response body text (e.g. the EPA's XML). */
export class RawBody {
  constructor(public text: string) {}
}

/**
 * Replaces global fetch with an in-memory API. Routes are keyed "METHOD /path"; a trailing
 * `*` matches any suffix ("PATCH /api/vehicles/*"). A reply can be a value (sent as JSON) or
 * a function of the request, so a test's fake server can hold state between calls. Anything
 * not routed answers 404, which the app treats as a failed lookup.
 */
export function mockApi(routes: Record<string, Reply>): MockApi {
  const calls: ApiCall[] = [];
  const all: ApiCall[] = [];

  const find = (key: string): Reply | undefined => {
    if (key in routes) return routes[key];
    const wildcard = Object.keys(routes).find((k) => k.endsWith('*') && key.startsWith(k.slice(0, -1)));
    return wildcard ? routes[wildcard] : undefined;
  };

  globalThis.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method ?? 'GET').toUpperCase();
    const path = url.startsWith('http') ? url.replace(/^https?:\/\/[^/]+/, '') : url;
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const call: ApiCall = { method, path, body, url, headers };
    all.push(call);
    if (url.startsWith('/api/')) calls.push(call);

    const key = `${method} ${path.split('?')[0]}`;
    const reply = find(key) ?? find(`${method} ${url.split('?')[0]}`);
    if (reply === undefined) {
      return { ok: false, status: 404, json: async () => null, text: async () => '' } as Response;
    }
    const value = typeof reply === 'function' ? await (reply as (c: ApiCall) => unknown)(call) : reply;

    if (value instanceof ApiError) {
      return { ok: false, status: value.status, json: async () => null, text: async () => '' } as Response;
    }
    if (value instanceof RawBody) {
      return { ok: true, status: 200, text: async () => value.text, json: async () => JSON.parse(value.text) } as Response;
    }
    if (value === undefined || value === null) {
      return { ok: true, status: 204, json: async () => null, text: async () => '' } as Response;
    }
    return { ok: true, status: 200, json: async () => value, text: async () => JSON.stringify(value) } as Response;
  }) as unknown as typeof fetch;

  return {
    calls,
    all,
    callsTo: (prefix) => calls.filter((c) => `${c.method} ${c.path}`.startsWith(prefix)),
    urlsTo: (prefix) =>
      all.filter((c) => c.url.startsWith(prefix)).map((c) => new URL(c.url.startsWith('http') ? c.url : `http://app${c.url}`)),
  };
}
