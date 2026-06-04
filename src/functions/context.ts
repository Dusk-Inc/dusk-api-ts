import { AsyncLocalStorage } from 'node:async_hooks';
import type { RequestContext } from "../contracts/index.js";

export const storage = new AsyncLocalStorage<RequestContext>();

export const getCorrelationId = (): string => {
  return storage.getStore()?.correlationId || 'no-context';
};
