import type { ExecutionResult, GraphQLError } from 'graphql';
import { CacheInstance, CacheNotFound, createCache } from '../Cache';
import { gqlessError } from '../Error';
import { doRetry } from '../Error/retry';
import { FetchEventData } from '../Events';
import { NormalizationHandler } from '../Normalization';
import { createQueryBuilder } from '../QueryBuilder';
import { SchedulerPromiseValue } from '../Scheduler';
import { Selection } from '../Selection/selection';
import { separateSelectionTypes } from '../Selection/SelectionManager';
import { createDeferredPromise, DeferredPromise, get } from '../Utils';
import { InnerClientState, SubscriptionsClient } from './client';

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
  /**
   * On subscription event listener
   */
  onSubscription?: (
    event:
      | {
          type: 'data';
          unsubscribe: () => Promise<void>;
          data: TData;
          error?: undefined;
        }
      | {
          type: 'with-errors';
          unsubscribe: () => Promise<void>;
          data?: TData;
          error: gqlessError;
        }
      | {
          type: 'start' | 'complete';
          unsubscribe: () => Promise<void>;
          data?: undefined;
          error?: undefined;
        }
  ) => void;
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

  ignoreResolveCache?: boolean;

  onSubscription?: ResolveOptions<any>['onSubscription'];
}

export type Resolvers = ReturnType<typeof createResolvers>;

function filterSelectionsWithErrors(
  graphQLErrors: readonly GraphQLError[] | undefined,
  executionData: Record<string, unknown> | null | undefined,
  selections: Selection[]
) {
  const gqlErrorsPaths = graphQLErrors
    ?.map((err) =>
      err.path
        ?.filter(
          (pathValue): pathValue is string => typeof pathValue === 'string'
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
            .map((selection) => selection.alias || selection.key)
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

  return selectionsWithErrors;
}

export function createResolvers(
  innerState: InnerClientState,
  catchSelectionsTimeMS: number,
  subscriptions?: SubscriptionsClient
) {
  const {
    interceptorManager,
    eventHandler,
    queryFetcher,
    scheduler,
    clientCache: globalCache,
  } = innerState;
  const { globalInterceptor } = interceptorManager;
  const buildQuery = createQueryBuilder();

  async function resolved<T = unknown>(
    dataFn: () => T,
    {
      refetch,
      noCache,
      onCacheData,
      onSelection,
      onSubscription,
    }: ResolveOptions<T> = {}
  ): Promise<T> {
    const prevFoundValidCache = innerState.foundValidCache;
    innerState.foundValidCache = true;

    let prevAllowCache = innerState.allowCache;
    if (refetch) {
      innerState.allowCache = false;
    }

    let tempCache: typeof innerState.clientCache | undefined;
    if (noCache) {
      innerState.clientCache = tempCache = createCache();
    }

    let prevGlobalInterceptorListening = globalInterceptor.listening;
    globalInterceptor.listening = false;

    const interceptor = interceptorManager.createInterceptor();

    if (onSelection) {
      interceptor.selectionAddListeners.add(onSelection);
      interceptor.selectionCacheListeners.add(onSelection);
      interceptor.selectionCacheRefetchListeners.add(onSelection);
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

      console.log('resolve selections!', interceptor.fetchSelections);

      await resolveSelections(
        interceptor.fetchSelections,
        tempCache || innerState.clientCache,
        {
          ignoreResolveCache: refetch || noCache,
          onSubscription: onSubscription
            ? (event) => {
                console.log(221, event);

                switch (event.type) {
                  case 'data':
                  case 'with-errors':
                    if (event.data) {
                      const prevAllowCache = innerState.allowCache;
                      try {
                        innerState.allowCache = true;
                        globalInterceptor.listening = false;
                        if (tempCache) {
                          innerState.clientCache = tempCache;
                        }
                        onSubscription({
                          ...event,
                          data: dataFn(),
                        });
                      } finally {
                        innerState.allowCache = prevAllowCache;
                        globalInterceptor.listening = true;
                        innerState.clientCache = globalCache;
                      }
                    } else {
                      onSubscription(event);
                    }
                    return;
                  default:
                    onSubscription(event);
                }
              }
            : undefined,
        }
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

  const resolutionTempCache = new Map<string, unknown>();
  const resolutionTempCacheTimeout = catchSelectionsTimeMS * 5;

  function buildQueryAndCheckTempCache<TData>(
    selections: Selection[],
    type: 'query' | 'mutation' | 'subscription',
    normalizationHandler: NormalizationHandler | undefined,
    ignoreResolveCache: boolean | undefined
  ) {
    const { query, variables, cacheKey } = buildQuery(
      selections,
      {
        type,
      },
      normalizationHandler != null
    );

    const cachedData = ignoreResolveCache
      ? undefined
      : (resolutionTempCache.get(cacheKey) as TData | undefined);

    return {
      query,
      variables,
      cacheKey,
      cachedData,
    };
  }

  async function buildAndFetchSelections<TData = unknown>(
    selections: Selection[] | undefined,
    type: 'query' | 'mutation',
    cache: CacheInstance = innerState.clientCache,
    options: FetchResolveOptions = {}
  ): Promise<TData | null | undefined> {
    if (!selections) return;

    const {
      query,
      variables,
      cachedData,
      cacheKey,
    } = buildQueryAndCheckTempCache<TData>(
      selections,
      type,
      innerState.normalizationHandler,
      options.ignoreResolveCache
    );

    let executionData: ExecutionResult['data'];

    let loggingPromise: DeferredPromise<FetchEventData> | undefined;

    try {
      if (cachedData != null) return cachedData;

      if (eventHandler.hasFetchSubscribers) {
        loggingPromise = createDeferredPromise<FetchEventData>();

        eventHandler.sendFetchPromise(loggingPromise.promise, selections);
      }

      const executionResult = await queryFetcher(query, variables);

      const { data, errors } = executionResult;

      if (data) {
        if (!errors && cacheKey) {
          resolutionTempCache.set(cacheKey, data);
          setTimeout(
            () => resolutionTempCache.delete(cacheKey),
            resolutionTempCacheTimeout
          );
        }

        cache.mergeCache(data, type);
        executionData = data;
      }

      if (errors?.length) {
        throw gqlessError.fromGraphQLErrors(errors);
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
      const error = gqlessError.create(err, () => {});
      loggingPromise?.resolve({
        error,
        query,
        variables,
        cacheSnapshot: cache.cache,
        selections,
        type,
      });

      if (options.scheduler) {
        const selectionsWithErrors = filterSelectionsWithErrors(
          error.graphQLErrors,
          executionData,
          selections
        );
        innerState.scheduler.errors.triggerError(error, selectionsWithErrors);
      }

      if (options.retry) {
        doRetry(options.retry, {
          onRetry: async () => {
            const retryPromise: Promise<SchedulerPromiseValue> = buildAndFetchSelections(
              selections,
              type,
              cache,
              Object.assign({}, options, {
                retry: false,
                ignoreResolveCache: true,
              } as FetchResolveOptions)
            ).then(
              (data) => ({ data, selections: new Set(selections) }),
              (err) => {
                console.error(err);
                return {
                  error: gqlessError.create(err),
                  selections: new Set(selections),
                };
              }
            );

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

  async function buildAndSubscribeSelections<TData = unknown>(
    selections: Selection[] | undefined,
    cache: CacheInstance = innerState.clientCache,
    options: FetchResolveOptions
  ) {
    if (!selections) return;

    if (!subscriptions) {
      console.error('ERROR: No subscriptions client specified!');
      return;
    }

    const { query, variables, cacheKey } = buildQueryAndCheckTempCache<TData>(
      selections,
      'subscription',
      innerState.normalizationHandler,
      true
    );
    console.log('build and sub selections', query, variables, cacheKey);

    const { unsubscribe } = await subscriptions.subscribe({
      query,
      variables,
      selections,
      cacheKey,
      onData(data) {
        cache.mergeCache(data, 'subscription');
        if (options.scheduler) {
          innerState.scheduler.errors.removeErrors(selections);
        }
        for (const selection of selections) {
          eventHandler.sendCacheChange({
            data,
            selection,
          });
        }

        options.onSubscription?.({
          type: 'data',
          unsubscribe,
          data,
        });
      },
      onError({ data, error }) {
        if (options.scheduler) {
          const selectionsWithErrors = filterSelectionsWithErrors(
            error.graphQLErrors,
            data,
            selections
          );
          innerState.scheduler.errors.triggerError(error, selectionsWithErrors);
        }
        options.onSubscription?.({
          type: 'with-errors',
          unsubscribe,
          data,
          error,
        });
      },
      onStart() {
        options.onSubscription?.({
          type: 'start',
          unsubscribe,
        });
      },
      onComplete() {
        options.onSubscription?.({
          type: 'complete',
          unsubscribe,
        });
      },
    });

    console.log('unsubscribe', unsubscribe);
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
      await Promise.all([
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
        buildAndSubscribeSelections<TSubscription>(
          subscriptionSelections,
          cache,
          options
        ),
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
