import { useEffect, useRef, useState } from 'react';

import { createClient, Selection } from '@dish/gqless';

import { CreateReactClientOptions } from '../client';
import {
  useDeferDispatch,
  useForceUpdate,
  useIsFirstMount,
  useIsomorphicLayoutEffect,
} from '../common';

export interface UseQueryOptions {
  suspense?: boolean;
  staleWhileRevalidate?: boolean;
}

export interface UseQuery<GeneratedSchema extends { query: object }> {
  (options?: UseQueryOptions): GeneratedSchema['query'];
}

function initSelectionsState() {
  return new Set<Selection>();
}

export function createUseQuery<
  GeneratedSchema extends {
    query: object;
  }
>(client: ReturnType<typeof createClient>, opts: CreateReactClientOptions) {
  const { defaultSuspense, defaultStaleWhileRevalidate } = opts;
  const { scheduler, eventHandler, interceptorManager } = client;

  const clientQuery: GeneratedSchema['query'] = client.query;

  const useQuery: UseQuery<GeneratedSchema> = function useQuery({
    suspense = defaultSuspense,
    staleWhileRevalidate = defaultStaleWhileRevalidate,
  }: UseQueryOptions = {}) {
    const [componentSelections] = useState(initSelectionsState);

    const fetchingPromise = useRef<Promise<void> | null>(null);
    const forceUpdate = useDeferDispatch(useForceUpdate());

    const interceptor = interceptorManager.createInterceptor();

    const isFirstMount = useIsFirstMount();

    if (staleWhileRevalidate && isFirstMount.current) {
      interceptor.selectionCacheRefetchListeners.add((selection) => {
        interceptorManager.globalInterceptor.addSelectionCacheRefetch(
          selection
        );

        componentSelections.add(selection);
      });
    }

    interceptor.selectionAddListeners.add((selection) => {
      componentSelections.add(selection);
    });

    interceptor.selectionCacheListeners.add((selection) => {
      componentSelections.add(selection);
    });

    const unsubscribe = scheduler.subscribeResolve((promise, selection) => {
      if (
        fetchingPromise.current === null &&
        componentSelections.has(selection)
      ) {
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
      }
    });

    setTimeout(() => {
      interceptorManager.removeInterceptor(interceptor);
      unsubscribe();
    }, 0);

    useIsomorphicLayoutEffect(() => {
      interceptorManager.removeInterceptor(interceptor);
      unsubscribe();
    });

    useEffect(() => {
      let isMounted = true;
      const unsubscribeFetch = eventHandler.onFetchSubscribe(
        (fetchPromise, promiseSelections) => {
          if (
            !promiseSelections.some((selection) =>
              componentSelections.has(selection)
            )
          )
            return;

          fetchPromise.then(
            () => {
              if (isMounted) forceUpdate();
            },
            () => {}
          );
        }
      );

      const unsubscribeCache = eventHandler.onCacheChangeSubscribe(
        ({ selection }) => {
          if (isMounted && componentSelections.has(selection)) {
            forceUpdate();
          }
        }
      );

      return () => {
        isMounted = false;
        unsubscribeFetch();
        unsubscribeCache();
      };
    }, [componentSelections]);

    if (suspense && fetchingPromise.current) {
      throw fetchingPromise.current;
    }

    return clientQuery;
  };

  return useQuery;
}
