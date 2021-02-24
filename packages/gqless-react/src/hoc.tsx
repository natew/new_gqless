import React, { ReactElement, useRef, useState } from 'react';

import { createClient, Selection } from '@dish/gqless';

import { CreateReactClientOptions } from './client';
import {
  useDeferDispatch,
  useForceUpdate,
  useIsFirstMount,
  useIsomorphicLayoutEffect,
} from './common';

export interface GraphQLHOCOptions {
  suspense?: boolean;
  staleWhileRevalidate?: boolean;
}

export interface GraphQLHOC {
  <R extends ReactElement<any, any> | null, P = unknown>(
    component: (props: P) => R,
    options?: GraphQLHOCOptions
  ): (props: P) => R;
}

function initSelectionsState() {
  return new Set<Selection>();
}

export function createGraphqlHOC(
  {
    scheduler,
    eventHandler,
    interceptorManager,
  }: ReturnType<typeof createClient>,
  { defaultSuspense, defaultStaleWhileRevalidate }: CreateReactClientOptions
) {
  const graphql: GraphQLHOC = function graphql<
    R extends ReactElement<any, any> | null,
    P = unknown
  >(
    component: (props: P) => R,
    {
      suspense = defaultSuspense,
      staleWhileRevalidate = defaultStaleWhileRevalidate,
    }: GraphQLHOCOptions = {}
  ) {
    const withGraphQL: {
      (props: P): R;
      displayName: string;
    } = function WithGraphQL(props) {
      const [componentSelections] = useState(initSelectionsState);
      let fetchingPromise = useRef<Promise<void> | null>(null);

      const forceUpdate = useDeferDispatch(useForceUpdate());

      useIsomorphicLayoutEffect(() => {
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
            if (isMounted && componentSelections.has(selection)) forceUpdate();
          }
        );

        return () => {
          isMounted = false;
          unsubscribeFetch();
          unsubscribeCache();
        };
      }, [componentSelections]);

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
              (err) => {
                fetchingPromise.current = null;
                reject(err);
              }
            );
          });
        }
      });

      let returnValue: R = null as R;
      try {
        returnValue = (component(props) ?? null) as R;
      } finally {
        interceptorManager.removeInterceptor(interceptor);
        unsubscribe();
      }

      if (suspense && fetchingPromise.current) {
        const Suspend = () => {
          if (!fetchingPromise.current) return null;

          throw fetchingPromise.current;
        };
        return (
          <>
            {returnValue}
            <Suspend />
          </>
        ) as R;
      }
      return returnValue;
    };
    withGraphQL.displayName = `GraphQLComponent(${
      (component as any)?.displayName || (component as any)?.name || 'Anonymous'
    })`;

    return withGraphQL;
  };

  return graphql;
}
