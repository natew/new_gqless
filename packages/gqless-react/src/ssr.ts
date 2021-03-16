import { ReactNode, useEffect } from 'react';

import { useOnFirstMount } from './common';

import type { createClient, HydrateCacheOptions } from '@dish/gqless';

export interface UseHydrateCacheOptions extends Partial<HydrateCacheOptions> {
  /**
   * Cache snapshot, returned from `prepareReactRender`
   */
  cacheSnapshot: string | undefined;
  /**
   * If it should refetch everything after the component is mounted
   *
   * @default
   * true
   */
  shouldRefetch?: boolean;
}

/**
 * Props with `cacheSnapshot` that would be returned from `prepareReactRender`
 */
export type PropsWithServerCache<
  T extends Record<string | number | symbol, unknown> = {}
> = {
  /**
   * Cache snapshot, returned from `prepareReactRender`
   */
  cacheSnapshot?: string;
} & T;

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
      if (cacheSnapshot) {
        client.hydrateCache({ cacheSnapshot, shouldRefetch: false });
      }
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
