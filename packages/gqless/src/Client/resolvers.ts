import { CacheInstance, createCache } from '../Cache';
import { gqlessError } from '../Error';
import { FetchEventData } from '../Events';
import { buildQuery } from '../QueryBuilder';
import { Selection } from '../Selection/selection';
import { separateSelectionTypes } from '../Selection/SelectionManager';
import { createLazyPromise, LazyPromise } from '../Utils';
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
}

const defaultMaxRetries = 3;

const defaultRetryDelay = (attemptIndex: number) =>
  Math.min(1000 * 2 ** attemptIndex, 30000);

export interface FetchResolveOptions {
  retry?:
    | {
        maxRetries?: number;
        retryDelay?: number | ((attemptIndex: number) => number);
      }
    | boolean
    | number;
  scheduler?: boolean;
}

export interface BuildAndFetchState {
  currentErrorRetry?: number;
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
    options: FetchResolveOptions = {},
    state: BuildAndFetchState = {}
  ): Promise<TData | null | undefined> {
    if (selections.length === 0) return;

    const { query, variables } = buildQuery(selections, {
      type,
    });

    let loggingPromise: LazyPromise<FetchEventData> | undefined;

    if (eventHandler.hasFetchSubscribers) {
      loggingPromise = createLazyPromise<FetchEventData>();

      eventHandler.sendFetchPromise(loggingPromise.promise, selections);
    }

    try {
      const executionResult = await queryFetcher(query, variables);

      const { data, errors } = executionResult;

      if (data) cache.mergeCache(data, type);

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

        if (options.scheduler) {
          innerState.scheduler.errors.triggerError(error, selections);
        }

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

      if (options.retry) {
        const currentErrorRetry = state.currentErrorRetry ?? 0;

        const maxRetries =
          typeof options.retry === 'number'
            ? options.retry
            : (typeof options.retry === 'object'
                ? options.retry.maxRetries
                : undefined) ?? defaultMaxRetries;
        const retryDelay =
          (typeof options.retry === 'object'
            ? options.retry.retryDelay
            : undefined) ?? defaultRetryDelay;

        if (currentErrorRetry < maxRetries) {
          setTimeout(
            () => {
              const retryPromise = buildAndFetchSelections(
                selections,
                type,
                cache,
                options,
                Object.assign({}, state, {
                  currentErrorRetry: currentErrorRetry + 1,
                } as typeof state)
              ).catch(console.error);

              if (options.scheduler) {
                const setSelections = new Set(selections);
                scheduler.pendingSelectionsGroups.add(setSelections);

                scheduler.errors.retryPromise(retryPromise, setSelections);

                retryPromise.finally(() => {
                  scheduler.pendingSelectionsGroups.delete(setSelections);
                });
              }
            },
            typeof retryDelay === 'function'
              ? retryDelay(currentErrorRetry)
              : retryDelay
          );
        }
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
