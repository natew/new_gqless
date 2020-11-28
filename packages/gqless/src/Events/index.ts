import { ExecutionResult } from 'graphql';

import { CacheType } from '../Cache';
import { gqlessError } from '../Error';
import { Selection } from '../Selection';

export interface FetchEventData {
  executionResult?: Pick<ExecutionResult, 'data' | 'extensions'>;
  error?: gqlessError;
  query: string;
  variables: Record<string, unknown> | undefined;
  cacheSnapshot: CacheType;
  selections: Selection[];
  type: 'query' | 'mutation' | 'subscription';
}

interface OnFetchEventFn {
  (data: Promise<FetchEventData>): void;
}

export class EventHandler {
  public hasFetchSubscribers = false;
  private onFetchListeners = new Set<OnFetchEventFn>();

  public sendFetchPromise(data: Promise<FetchEventData>) {
    this.onFetchListeners.forEach((listener) => {
      listener(data);
    });
  }

  public onFetchSubscribe(fn: OnFetchEventFn) {
    const self = this;

    self.hasFetchSubscribers = Boolean(self.onFetchListeners.add(fn).size);

    return function unsubscribe() {
      self.onFetchListeners.delete(fn);
      self.hasFetchSubscribers = Boolean(self.onFetchListeners.size);
    };
  }
}
