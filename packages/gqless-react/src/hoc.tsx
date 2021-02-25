import React, { ReactElement } from 'react';

import { createClient } from '@dish/gqless';

import { CreateReactClientOptions } from './client';
import { useInterceptSelections } from './common';

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
    component: ((props: P) => R) & { displayName?: string },
    {
      suspense = defaultSuspense,
      staleWhileRevalidate = defaultStaleWhileRevalidate,
    }: GraphQLHOCOptions = {}
  ) {
    const withGraphQL: {
      (props: P): R;
      displayName: string;
    } = function WithGraphQL(props) {
      const { fetchingPromise, unsubscribe } = useInterceptSelections({
        interceptorManager,
        eventHandler,
        scheduler,
        staleWhileRevalidate,
      });

      let returnValue: R = null as R;
      try {
        returnValue = (component(props) ?? null) as R;
      } finally {
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
      component?.displayName || component?.name || 'Anonymous'
    })`;

    return withGraphQL;
  };

  return graphql;
}
