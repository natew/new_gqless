import type { AccessorCreators } from '../Accessor';
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
   * true
   */
  shouldRefetch?: boolean | number;
}

export function createSSRHelpers({
  setCache,
  query,
  refetch,
  innerState,
}: {
  setCache: ReturnType<typeof AccessorCreators>['setCache'];
  query: ProxyAccessor;
  refetch: ReturnType<typeof createRefetch>;
  innerState: InnerClientState;
}) {
  const hydrateCache = ({
    cacheSnapshot,
    shouldRefetch = true,
  }: HydrateCacheOptions) => {
    try {
      const cache = JSON.parse(cacheSnapshot);
      if (typeof cache.query === 'object') {
        setCache(query, cache.query);

        if (shouldRefetch) {
          setTimeout(
            () => {
              refetch(query);
            },
            typeof refetch === 'number' ? refetch : 0
          );
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const prepareRender = async (render: () => Promise<void> | void) => {
    setCache(query, null);

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
