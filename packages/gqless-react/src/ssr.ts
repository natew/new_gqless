import { ReactNode, useEffect } from 'react';

import { createClient, HydrateCacheOptions } from '@dish/gqless';

import { useOnFirstMount } from './common';

export function createSSRHelpers(client: ReturnType<typeof createClient>) {
  async function prepareReactRender(element: ReactNode) {
    const ssrPrepass = (await import('react-ssr-prepass')).default;
    return client.prepareRender(() => ssrPrepass(element));
  }
  function useHydrateCache({
    cacheSnapshot,
    shouldRefetch = true,
  }: HydrateCacheOptions) {
    useOnFirstMount(() => {
      client.hydrateCache({ cacheSnapshot, shouldRefetch: false });
    });
    useEffect(() => {
      if (shouldRefetch) {
        if (typeof shouldRefetch === 'number') {
          setTimeout(() => {
            client.refetch(client.query).catch(console.error);
          }, shouldRefetch);
        } else {
          client.refetch(client.query).catch(console.error);
        }
      }
    }, [shouldRefetch]);
  }

  return {
    useHydrateCache,
    prepareReactRender,
  };
}
