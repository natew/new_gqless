import { useEffect, useRef } from 'react';

import { createClient } from '@dish/gqless';

import { CreateReactClientOptions } from '../client';
import { useBatchUpdate } from '../common';

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
  }: {
    suspense?: boolean;
  } = {}) {
    const fetchingPromise = useRef<Promise<void>>();
    const forceUpdate = useBatchUpdate();

    const unsubscribe = scheduler.subscribeResolve((promise) => {
      fetchingPromise.current = new Promise<void>((resolve, reject) => {
        promise.then(
          () => {
            fetchingPromise.current = undefined;
            forceUpdate();
            resolve();
          },
          (err) => {
            fetchingPromise.current = undefined;
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
