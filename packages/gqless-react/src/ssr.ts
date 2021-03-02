import { ReactNode, useEffect } from 'react';

import { createClient, HydrateCacheOptions } from '@dish/gqless';

import { useOnFirstMount } from './common';

export interface UseHydrateCacheOptions extends HydrateCacheOptions {
  /**
   * If it should refetch everything after the component is mounted
   *
   * @default
   * true
   */
  shouldRefetch?: boolean;
}

export function createSSRHelpers(client: ReturnType<typeof createClient>) {
  async function prepareReactRender(element: ReactNode) {
    const ssrPrepass = (await import('react-ssr-prepass')).default;
    return client.prepareRender(() => ssrPrepass(element));
  }
  function useHydrateCache({
    cacheSnapshot,
    shouldRefetch = true,
  }: UseHydrateCacheOptions) {
    useOnFirstMount(() => {
      client.hydrateCache({ cacheSnapshot, shouldRefetch: false });
    });
    useEffect(() => {
      if (shouldRefetch) {
        client.refetch(client.query).catch(console.error);
      }
    }, [shouldRefetch]);
  }

  return {
    useHydrateCache,
    prepareReactRender,
  };
}
