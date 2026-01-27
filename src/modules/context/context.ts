
import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  correlationId: string;
}

export const storage = new AsyncLocalStorage<RequestContext>();

export const getCorrelationId = (): string => {
  return storage.getStore()?.correlationId || 'no-context';
};