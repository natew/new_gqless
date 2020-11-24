import React, { ReactElement, useEffect, useRef } from 'react';

import { createClient } from '@dish/gqless';

import { CreateReactClientOptions } from './client';
import { useBatchUpdate } from './common';

export function createGraphqlHOC(
  { scheduler }: ReturnType<typeof createClient>,
  { defaultSuspense }: CreateReactClientOptions
) {
  return function graphql<R extends ReactElement<any, any> | null, P = unknown>(
    component: (props: P) => R,
    { suspense = defaultSuspense }: { suspense?: boolean } = {}
  ) {
    const withGraphQL: {
      (props: P): R;
      displayName: string;
    } = function WithGraphQL(props) {
      let fetchingPromise = useRef<Promise<void>>();

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

      const returnValue: R = component(props);

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
}
