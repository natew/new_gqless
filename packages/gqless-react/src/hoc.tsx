import React, { ReactNode, Suspense, SuspenseProps } from 'react';

import { createClient } from '@dish/gqless';

import { useInterceptSelections } from './common';
import { ReactClientOptionsWithDefaults } from './utils';

export interface GraphQLHOCOptions {
  suspense?:
    | boolean
    | {
        fallback: SuspenseProps['fallback'];
      };
  staleWhileRevalidate?: boolean;
}

<Suspense fallback></Suspense>;

export interface GraphQLHOC {
  <P>(
    component: (props: P) => ReactNode,
    options?: GraphQLHOCOptions
  ): ReactNode;
}

export function createGraphqlHOC(
  {
    scheduler,
    eventHandler,
    interceptorManager,
  }: ReturnType<typeof createClient>,
  {
    defaults: {
      suspense: defaultSuspense,
      staleWhileRevalidate: defaultStaleWhileRevalidate,
    },
  }: ReactClientOptionsWithDefaults
) {
  const graphql: GraphQLHOC = function graphql<P>(
    component: ((props: P) => ReactNode) & { displayName?: string },
    {
      suspense = defaultSuspense,
      staleWhileRevalidate = defaultStaleWhileRevalidate,
    }: GraphQLHOCOptions = {}
  ) {
    const withGraphQL: {
      (props: P): ReactNode;
      displayName: string;
    } = function WithGraphQL(props): ReactNode {
      const { fetchingPromise, unsubscribe } = useInterceptSelections({
        interceptorManager,
        eventHandler,
        scheduler,
        staleWhileRevalidate,
      });

      let returnValue: ReactNode = null;
      try {
        returnValue = component(props) ?? null;
      } finally {
        unsubscribe();
      }

      if (suspense && fetchingPromise.current) {
        const Suspend = () => {
          if (!fetchingPromise.current) return null;

          throw fetchingPromise.current;
        };
        const value = (
          <>
            {returnValue}
            <Suspend />
          </>
        );
        if (typeof suspense === 'object') {
          return <Suspense fallback={suspense.fallback} children={value} />;
        }
        return value;
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
