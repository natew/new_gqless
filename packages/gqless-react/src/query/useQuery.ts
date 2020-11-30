import { useEffect, useRef } from 'react';

import { createClient } from '@dish/gqless';

import { CreateReactClientOptions } from '../client';
import { useDeferDispatch, useForceUpdate } from '../common';

export interface UseQueryOptions {
  suspense?: boolean;
}

export interface UseQuery<GeneratedSchema extends { query: object }> {
  (options?: UseQueryOptions): GeneratedSchema['query'];
}

export function createUseQuery<
  GeneratedSchema extends {
    query: object;
  }
>(client: ReturnType<typeof createClient>, opts: CreateReactClientOptions) {
  const { defaultSuspense } = opts;
  const { scheduler, eventHandler } = client;

  const clientQuery: GeneratedSchema['query'] = client.query;

  const useQuery: UseQuery<GeneratedSchema> = function useQuery({
    suspense = defaultSuspense,
  } = {}) {
    const fetchingPromise = useRef<Promise<void> | null>(null);
    const forceUpdate = useDeferDispatch(useForceUpdate());

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
      let isMounted = true;
      const unsubscribeFetch = eventHandler.onFetchSubscribe((fetchPromise) => {
        fetchPromise.then(
          (data) => {
            if (isMounted) {
              console.warn('update after fetch', data);
              forceUpdate();
            }
          },
          () => {}
        );
      });

      return () => {
        isMounted = false;
        unsubscribeFetch();
      };
    }, []);

    useEffect(() => {
      unsubscribe();
    });

    if (suspense && fetchingPromise.current) {
      throw fetchingPromise.current;
    }

    return clientQuery;
  };

  return useQuery;
}
