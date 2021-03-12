import type { createClient } from '@dish/gqless';

import {
  OnErrorHandler,
  useInterceptSelections,
  useIsomorphicLayoutEffect,
} from '../common';
import { ReactClientOptionsWithDefaults } from '../utils';

export interface UseQueryOptions {
  suspense?: boolean;
  staleWhileRevalidate?: boolean | object | number | string | null;
  onError?: OnErrorHandler;
}

export interface UseQuery<GeneratedSchema extends { query: object }> {
  (options?: UseQueryOptions): GeneratedSchema['query'];
}

export function createUseQuery<
  GeneratedSchema extends {
    query: object;
  }
>(
  client: ReturnType<typeof createClient>,
  opts: ReactClientOptionsWithDefaults
) {
  const {
    suspense: defaultSuspense,
    staleWhileRevalidate: defaultStaleWhileRevalidate,
  } = opts.defaults;
  const { scheduler, eventHandler, interceptorManager } = client;

  const clientQuery: GeneratedSchema['query'] = client.query;

  const useQuery: UseQuery<GeneratedSchema> = function useQuery({
    suspense = defaultSuspense,
    staleWhileRevalidate = defaultStaleWhileRevalidate,
    onError,
  }: UseQueryOptions = {}): GeneratedSchema['query'] {
    const { unsubscribe, fetchingPromise } = useInterceptSelections({
      staleWhileRevalidate,
      eventHandler,
      interceptorManager,
      scheduler,
      onError,
    });

    useIsomorphicLayoutEffect(unsubscribe);

    if (suspense && fetchingPromise.current) {
      throw fetchingPromise.current;
    }

    return clientQuery;
  };

  return useQuery;
}
