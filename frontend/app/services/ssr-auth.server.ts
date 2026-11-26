import { AsyncLocalStorage } from "node:async_hooks";
import { registerServerTokenGetter } from "./api.service";

const requestAuthStorage = new AsyncLocalStorage<string | null>();

// Bind SSR token lookup per async execution context so concurrent requests
// never share or leak another user's JWT.
registerServerTokenGetter(() => requestAuthStorage.getStore() ?? null);

/** Execute a server loader/action callback isolated to a single request's JWT. */
export function runWithServerToken<T>(token: string | null, fn: () => T): T {
  return requestAuthStorage.run(token, fn);
}
