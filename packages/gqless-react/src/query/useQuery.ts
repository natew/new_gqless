import { useEffect, useRef } from 'react';

import { createClient } from '@dish/gqless';

import { CreateReactClientOptions } from '../client';
import { useForceUpdate } from '../common';

export interface UseQueryOptions {
  suspense?: boolean;
}

export function createUseQuery<
  GeneratedSchema extends {
    query: object;
    mutation: object;
    subscription: object;
  }
>(client: ReturnType<typeof createClient>, opts: CreateReactClientOptions) {
  const { defaultSuspense } = opts;
  const { scheduler } = client;

  const clientQuery: GeneratedSchema['query'] = client.query;

  return function useQuery({
    suspense = defaultSuspense,
  }: UseQueryOptions = {}) {
    const fetchingPromise = useRef<Promise<void> | null>(null);
    const forceUpdate = useForceUpdate();

    const unsubscribe = scheduler.subscribeResolve((promise) => {
      fetchingPromise.current = new Promise<void>((resolve, reject) => {
        promise.then(
          () => {
            fetchingPromise.current = null;
            forceUpdate();
            resolve();
          },
          (err: unknown) => {
            fetchingPromise.current = null;
            reject(err);
          }
        );
      });
      forceUpdate();
    });

    useEffect(() => {
      return unsubscribe;
    });

    if (suspense && fetchingPromise.current) {
      throw fetchingPromise.current;
    }

    return clientQuery;
  };
}
