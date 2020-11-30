import React, { ReactElement, useRef, useState } from 'react';

import { createClient, Selection } from '@dish/gqless';

import { CreateReactClientOptions } from './client';
import {
  useDeferDispatch,
  useForceUpdate,
  useIsomorphicLayoutEffect,
} from './common';

export interface GraphQLHOCOptions {
  suspense?: boolean;
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
  { defaultSuspense }: CreateReactClientOptions
) {
  const graphql: GraphQLHOC = function graphql<
    R extends ReactElement<any, any> | null,
    P = unknown
  >(
    component: (props: P) => R,
    { suspense = defaultSuspense }: GraphQLHOCOptions = {}
  ) {
    const withGraphQL: {
      (props: P): R;
      displayName: string;
    } = function WithGraphQL(props) {
      const [selections] = useState(initSelectionsState);
      let fetchingPromise = useRef<Promise<void> | null>(null);

      const forceUpdate = useDeferDispatch(useForceUpdate());

      useIsomorphicLayoutEffect(() => {
        let isMounted = true;
        const unsubscribeFetch = eventHandler.onFetchSubscribe(
          (fetchPromise) => {
            fetchPromise.then(
              (data) => {
                if (
                  isMounted &&
                  data.selections.some((selection) => selections.has(selection))
                ) {
                  forceUpdate();
                }
              },
              () => {}
            );
          }
        );

        return () => {
          isMounted = false;
          unsubscribeFetch();
        };
      }, []);

      const interceptor = interceptorManager.createInterceptor();

      interceptor.selectionAddListeners.add((selection) => {
        selections.add(selection);
      });

      const unsubscribe = scheduler.subscribeResolve((promise, selection) => {
        if (fetchingPromise.current === null && selections.has(selection)) {
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
