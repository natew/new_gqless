import { InnerClientState } from './client';
import { CacheInstance, createCache } from '../Cache';
import { gqlessError } from '../Error';
import { FetchEventData } from '../Events';
import { buildQuery } from '../QueryBuilder';
import { Selection, separateSelectionTypes } from '../Selection';
import { createLazyPromise, LazyPromise } from '../Utils';

export interface ResolveOptions<TData> {
  /**
   * Set to `true` to refetch the data requirements
   */
  refetch?: boolean;
  /**
   * Ignore the client cache
   */
  noCache?: boolean;
  /**
   * Middleware function that is called if valid cache is found
   * for all the data requirements, it should return `true` if the
   * the resolution and fetch should continue, and `false`
   * if you wish to stop the resolution, resolving the promise
   * with the existing cache data.
   */
  onCacheData?: (data: TData) => boolean;
}

export function createResolvers(innerState: InnerClientState) {
  const { interceptorManager, eventHandler, queryFetcher } = innerState;
  const { globalInterceptor } = interceptorManager;

  async function resolved<T = unknown>(
    dataFn: () => T,
    { refetch, noCache, onCacheData }: ResolveOptions<T> = {}
  ): Promise<T> {
    const prevFoundValidCache = innerState.foundValidCache;
    innerState.foundValidCache = true;

    let prevAllowCache = innerState.allowCache;
    if (refetch) {
      innerState.allowCache = false;
    }

    const globalCache = innerState.clientCache;
    let tempCache: typeof innerState.clientCache | undefined;
    if (noCache) {
      innerState.clientCache = tempCache = createCache();
    }

    let prevGlobalInterceptorListening = globalInterceptor.listening;
    globalInterceptor.listening = false;

    const interceptor = interceptorManager.createInterceptor();

    try {
      const data = dataFn();

      if (interceptor.fetchSelections.size === 0) {
        return data;
      }

      interceptorManager.removeInterceptor(interceptor);

      if (innerState.foundValidCache && onCacheData) {
        const shouldContinue = onCacheData(data);

        if (!shouldContinue) return data;
      }

      innerState.foundValidCache = prevFoundValidCache;
      innerState.allowCache = prevAllowCache;
      innerState.clientCache = globalCache;

      globalInterceptor.listening = prevGlobalInterceptorListening;

      await resolveSelections(
        interceptor.fetchSelections,
        tempCache || innerState.clientCache
      );

      prevAllowCache = innerState.allowCache;
      innerState.allowCache = true;

      prevGlobalInterceptorListening = globalInterceptor.listening;
      globalInterceptor.listening = false;

      if (tempCache) {
        innerState.clientCache = tempCache;
      }

      return dataFn();
    } catch (err) {
      const error = gqlessError.create(err);

      /* istanbul ignore else */
      if (Error.captureStackTrace!) {
        Error.captureStackTrace(err, resolved);
      }

      throw error;
    } finally {
      interceptorManager.removeInterceptor(interceptor);
      innerState.allowCache = prevAllowCache;
      innerState.clientCache = globalCache;
      innerState.foundValidCache = prevFoundValidCache;
      globalInterceptor.listening = prevGlobalInterceptorListening;
    }
  }

  async function buildAndFetchSelections(
    selections: Selection[],
    type: 'query' | 'mutation' | 'subscription',
    cache: CacheInstance = innerState.clientCache
  ) {
    if (selections.length === 0) return;

    const { query, variables } = buildQuery(selections, {
      type,
    });

    let loggingPromise: LazyPromise<FetchEventData> | undefined;

    if (eventHandler.hasFetchSubscribers) {
      loggingPromise = createLazyPromise<FetchEventData>();

      eventHandler.sendFetchPromise(loggingPromise.promise);
    }

    try {
      const executionResult = await queryFetcher(query, variables);

      const { data, errors } = executionResult;

      if (errors?.length) {
        if (errors.length > 1) {
          const err = new gqlessError(
            `GraphQL Errors${
              process.env.NODE_ENV === 'production'
                ? ''
                : ', please check .graphQLErrors property'
            }`,
            {
              graphQLErrors: errors,
            }
          );

          throw err;
        } else {
          const error = new gqlessError(errors[0].message, {
            graphQLErrors: errors,
          });

          throw error;
        }
      }

      if (data) {
        cache.mergeCache(data, type);
      }

      loggingPromise?.resolve({
        executionResult,
        query,
        variables,
        cacheSnapshot: cache.cache,
        selections,
        type,
      });
    } catch (err) {
      const error = gqlessError.create(err);
      loggingPromise?.resolve({
        error,
        query,
        variables,
        cacheSnapshot: cache.cache,
        selections,
        type,
      });
      throw error;
    } finally {
      interceptorManager.removeSelections(selections);
    }
  }

  async function resolveSelections(
    selections: Selection[] | Set<Selection>,
    cache: CacheInstance = innerState.clientCache
  ) {
    const {
      querySelections,
      mutationSelections,
      subscriptionSelections,
    } = separateSelectionTypes(selections);

    try {
      await Promise.all([
        buildAndFetchSelections(querySelections, 'query', cache),
        buildAndFetchSelections(mutationSelections, 'mutation', cache),
        buildAndFetchSelections(subscriptionSelections, 'subscription', cache),
      ]);
    } catch (err) {
      throw gqlessError.create(err);
    }
  }

  return {
    resolveSelections,
    buildAndFetchSelections,
    resolved,
  };
}
