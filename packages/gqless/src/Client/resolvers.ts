import type { ExecutionResult } from 'graphql';
import { CacheInstance, CacheNotFound, createCache } from '../Cache';
import { gqlessError } from '../Error';
import { doRetry } from '../Error/retry';
import { FetchEventData } from '../Events';
import { buildQuery } from '../QueryBuilder';
import { Selection } from '../Selection/selection';
import { separateSelectionTypes } from '../Selection/SelectionManager';
import { createLazyPromise, get, LazyPromise } from '../Utils';
import { InnerClientState } from './client';

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
  /**
   * Get every selection intercepted in the specified function
   */
  onSelection?: (selection: Selection) => void;
}

export type RetryOptions =
  | {
      /**
       * Amount of retries to be made
       * @default 3
       */
      maxRetries?: number;
      /**
       * Amount of milliseconds between each attempt, it can be a static number,
       * or a function based on the attempt number
       *
       * @default attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000)
       */
      retryDelay?: number | ((attemptIndex: number) => number);
    }
  /** If retries should be enabled
   * @default true
   */
  | boolean
  /** Amount of retries to be made
   * @default 3
   */
  | number;

export interface FetchResolveOptions {
  retry?: RetryOptions;

  scheduler?: boolean;
}

export function createResolvers(innerState: InnerClientState) {
  const {
    interceptorManager,
    eventHandler,
    queryFetcher,
    scheduler,
  } = innerState;
  const { globalInterceptor } = interceptorManager;

  async function resolved<T = unknown>(
    dataFn: () => T,
    {
      refetch,
      noCache,
      onCacheData,
      onSelection: onSelectionAdd,
    }: ResolveOptions<T> = {}
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

    if (onSelectionAdd) {
      interceptor.selectionAddListeners.add(onSelectionAdd);
      interceptor.selectionCacheListeners.add(onSelectionAdd);
      interceptor.selectionCacheRefetchListeners.add(onSelectionAdd);
    }

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
      throw gqlessError.create(err, resolved);
    } finally {
      interceptorManager.removeInterceptor(interceptor);
      innerState.allowCache = prevAllowCache;
      innerState.clientCache = globalCache;
      innerState.foundValidCache = prevFoundValidCache;
      globalInterceptor.listening = prevGlobalInterceptorListening;
    }
  }

  async function buildAndFetchSelections<TData = unknown>(
    selections: Selection[],
    type: 'query' | 'mutation' | 'subscription',
    cache: CacheInstance = innerState.clientCache,
    options: FetchResolveOptions = {}
  ): Promise<TData | null | undefined> {
    if (selections.length === 0) return;

    const { query, variables } = buildQuery(
      selections,
      {
        type,
      },
      innerState.normalizationHandler
    );

    let loggingPromise: LazyPromise<FetchEventData> | undefined;

    if (eventHandler.hasFetchSubscribers) {
      loggingPromise = createLazyPromise<FetchEventData>();

      eventHandler.sendFetchPromise(loggingPromise.promise, selections);
    }

    let executionData: ExecutionResult['data'];
    try {
      const executionResult = await queryFetcher(query, variables);

      const { data, errors } = executionResult;

      if (data) {
        cache.mergeCache(data, type);
        executionData = data;
      }

      if (errors?.length) {
        const error =
          errors.length > 1
            ? new gqlessError(
                `GraphQL Errors${
                  process.env.NODE_ENV === 'production'
                    ? ''
                    : ', please check .graphQLErrors property'
                }`,
                {
                  graphQLErrors: errors,
                }
              )
            : new gqlessError(errors[0].message, {
                graphQLErrors: errors,
              });

        throw error;
      } else if (options.scheduler) {
        innerState.scheduler.errors.removeErrors(selections);
      }

      loggingPromise?.resolve({
        executionResult,
        query,
        variables,
        cacheSnapshot: cache.cache,
        selections,
        type,
      });

      return data as TData;
    } catch (err) {
      const error = gqlessError.create(err, buildAndFetchSelections);
      loggingPromise?.resolve({
        error,
        query,
        variables,
        cacheSnapshot: cache.cache,
        selections,
        type,
      });

      if (options.scheduler) {
        const gqlErrorsPaths = error.graphQLErrors
          ?.map((err) =>
            err.path
              ?.filter(
                (pathValue): pathValue is string =>
                  typeof pathValue === 'string'
              )
              .join('.')
          )
          .filter((possiblePath): possiblePath is NonNullable<
            typeof possiblePath
          > => {
            return !!possiblePath;
          });
        const selectionsWithErrors =
          !gqlErrorsPaths?.length || !executionData
            ? selections
            : selections.filter((selection) => {
                const selectionPathNoIndex = selection.noIndexSelections
                  .slice(1)
                  .join('.');

                const selectionData = get(
                  executionData,
                  selectionPathNoIndex,
                  CacheNotFound
                );

                switch (selectionData) {
                  case CacheNotFound: {
                    return true;
                  }
                  case null: {
                    return gqlErrorsPaths.includes(selectionPathNoIndex);
                  }
                  default:
                    return false;
                }
              });
        innerState.scheduler.errors.triggerError(error, selectionsWithErrors);
      }

      if (options.retry) {
        doRetry(options.retry, {
          onRetry: async () => {
            const retryPromise: Promise<{
              error?: gqlessError;
              data?: unknown;
            }> = buildAndFetchSelections(
              selections,
              type,
              cache,
              Object.assign({}, options, {
                retry: false,
              } as FetchResolveOptions)
            )
              .then((data) => ({ data }))
              .catch((err) => {
                console.error(err);
                return {
                  error: gqlessError.create(err, buildAndFetchSelections),
                };
              });

            if (options.scheduler) {
              const setSelections = new Set(selections);
              scheduler.pendingSelectionsGroups.add(setSelections);

              scheduler.errors.retryPromise(retryPromise, setSelections);

              retryPromise.finally(() => {
                scheduler.pendingSelectionsGroups.delete(setSelections);
              });
            }

            const { error } = await retryPromise;

            if (error) throw error;
          },
        });
      }

      throw error;
    } finally {
      interceptorManager.removeSelections(selections);
    }
  }

  async function resolveSelections<
    TQuery = unknown,
    TMutation = unknown,
    TSubscription = unknown
  >(
    selections: Selection[] | Set<Selection>,
    cache: CacheInstance = innerState.clientCache,
    options: FetchResolveOptions = {}
  ) {
    const {
      querySelections,
      mutationSelections,
      subscriptionSelections,
    } = separateSelectionTypes(selections);

    try {
      const [
        queryResult,
        mutationResult,
        subscriptionResult,
      ] = await Promise.all([
        buildAndFetchSelections<TQuery>(
          querySelections,
          'query',
          cache,
          options
        ),
        buildAndFetchSelections<TMutation>(
          mutationSelections,
          'mutation',
          cache,
          options
        ),
        buildAndFetchSelections<TSubscription>(
          subscriptionSelections,
          'subscription',
          cache,
          options
        ),
      ]);

      return {
        queryResult,
        mutationResult,
        subscriptionResult,
      };
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
