import type { ProxyAccessor } from '../Cache';
import type { InnerClientState } from '../Client/client';
import type { createRefetch } from './refetch';

export interface HydrateCacheOptions {
  /**
   * Cache snapshot, returned from `prepareRender`
   */
  cacheSnapshot: string;
  /**
   * If it should refetch everything after
   *
   * Specify a number greater than `0` to delay the refetch that amount in ms
   *
   * @default
   * false
   */
  shouldRefetch?: boolean | number;
}

export function createSSRHelpers({
  query,
  refetch,
  innerState,
}: {
  query: ProxyAccessor;
  refetch: ReturnType<typeof createRefetch>;
  innerState: InnerClientState;
}) {
  const hydrateCache = ({
    cacheSnapshot,
    shouldRefetch = false,
  }: HydrateCacheOptions) => {
    try {
      const cache = JSON.parse(cacheSnapshot);
      if (typeof cache.query === 'object') {
        innerState.clientCache.cache.query = cache.query;

        if (shouldRefetch) {
          setTimeout(
            () => {
              refetch(query).catch(console.error);
            },
            typeof shouldRefetch === 'number' ? shouldRefetch : 0
          );
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const prepareRender = async (render: () => Promise<void> | void) => {
    delete innerState.clientCache.cache.query;

    await render();

    await innerState.scheduler.resolving?.promise;

    return {
      cacheSnapshot: JSON.stringify(innerState.clientCache.cache),
    };
  };

  return {
    hydrateCache,
    prepareRender,
  };
}
