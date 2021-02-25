import { createClient } from '@dish/gqless';

import { CreateReactClientOptions } from '../client';
import { useInterceptSelections, useIsomorphicLayoutEffect } from '../common';

export interface UseQueryOptions {
  suspense?: boolean;
  staleWhileRevalidate?: boolean;
}

export interface UseQuery<GeneratedSchema extends { query: object }> {
  (options?: UseQueryOptions): GeneratedSchema['query'];
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
  }: UseQueryOptions = {}): GeneratedSchema['query'] {
    const { unsubscribe, fetchingPromise } = useInterceptSelections({
      staleWhileRevalidate,
      eventHandler,
      interceptorManager,
      scheduler,
    });

    useIsomorphicLayoutEffect(unsubscribe);

    if (suspense && fetchingPromise.current) {
      throw fetchingPromise.current;
    }

    return clientQuery;
  };

  return useQuery;
}
