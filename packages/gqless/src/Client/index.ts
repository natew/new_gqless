import { GraphQLError } from 'graphql/error';
import fromPairs from 'lodash/fromPairs';
import lodashGet from 'lodash/get';
import lodashSet from 'lodash/set';

import { CacheNotFound, createAccessorCache, createCache } from '../Cache';
import { gqlessError } from '../Error';
import { EventHandler, FetchEventData } from '../Events';
import { createInterceptorManager } from '../Interceptor';
import { buildQuery } from '../QueryBuilder';
import { createScheduler } from '../Scheduler';
import {
  parseSchemaType,
  QueryFetcher,
  ScalarsEnumsHash,
  Schema,
} from '../Schema/types';
import {
  Selection,
  SelectionManager,
  SelectionType,
  separateSelectionTypes,
} from '../Selection';
import { createLazyPromise, isInteger, LazyPromise } from '../Utils';

const ProxySymbol = Symbol('gqless-proxy');

export interface GraphQLErrorsContainer extends Error {
  errors: readonly GraphQLError[];
}

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

export function createClient<
  GeneratedSchema extends {
    query: {};
    mutation: {};
    subscription: {};
  } = never
>(
  schema: Readonly<Schema>,
  scalarsEnumsHash: ScalarsEnumsHash,
  queryFetcher: QueryFetcher
) {
  const interceptorManager = createInterceptorManager();

  const globalInterceptor = interceptorManager.globalInterceptor;

  const client: GeneratedSchema = createSchemaAccesor();
  let clientCache = createCache();

  const innerState = {
    allowCache: true,
    foundValidCache: true,
  };

  async function resolveAllSelections() {
    const resolvingPromise = scheduler.resolving!;

    try {
      await resolveSelections(globalInterceptor.selections);
    } catch (err) {
      resolvingPromise.promise.catch(console.error);
      resolvingPromise.reject(err);
    }
  }

  const selectionManager = new SelectionManager();

  const accessorCache = createAccessorCache();

  const scheduler = createScheduler(interceptorManager, resolveAllSelections);

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

    const globalCache = clientCache;
    let tempCache: typeof clientCache | undefined;
    if (noCache) {
      clientCache = tempCache = createCache();
    }

    let prevGlobalInterceptorListening = globalInterceptor.listening;
    globalInterceptor.listening = false;

    const interceptor = interceptorManager.createInterceptor();

    try {
      const data = dataFn();

      if (interceptor.selections.size === 0) {
        return data;
      }

      interceptorManager.removeInterceptor(interceptor);

      if (innerState.foundValidCache && onCacheData) {
        const shouldContinue = onCacheData(data);

        if (!shouldContinue) return data;
      }

      innerState.foundValidCache = prevFoundValidCache;
      innerState.allowCache = prevAllowCache;
      clientCache = globalCache;

      globalInterceptor.listening = prevGlobalInterceptorListening;

      await resolveSelections(interceptor.selections, tempCache || clientCache);

      prevAllowCache = innerState.allowCache;
      innerState.allowCache = true;

      prevGlobalInterceptorListening = globalInterceptor.listening;
      globalInterceptor.listening = false;

      if (tempCache) {
        clientCache = tempCache;
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
      clientCache = globalCache;
      innerState.foundValidCache = prevFoundValidCache;
      globalInterceptor.listening = prevGlobalInterceptorListening;
    }
  }

  async function refetch<T = undefined | void>(refetchFn: () => T) {
    const startSelectionsSize =
      interceptorManager.globalInterceptor.selections.size;

    let prevIgnoreCache = innerState.allowCache;

    try {
      innerState.allowCache = false;

      const data = refetchFn();

      innerState.allowCache = prevIgnoreCache;

      if (
        interceptorManager.globalInterceptor.selections.size ===
        startSelectionsSize
      ) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Warning: No selections made!');
        }
        return data;
      }

      await scheduler.resolving!.promise;

      prevIgnoreCache = innerState.allowCache;
      innerState.allowCache = true;

      return refetchFn();
    } finally {
      innerState.allowCache = prevIgnoreCache;
    }
  }

  const eventHandler = new EventHandler();

  async function buildAndFetchSelections(
    selections: Selection[],
    type: 'query' | 'mutation' | 'subscription',
    cache: typeof clientCache = clientCache
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
    cache: typeof clientCache = clientCache
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

  const proxySymbolArray = [ProxySymbol];

  function createArrayAccessor(
    schemaType: Schema[string],
    selectionArg: Selection
  ) {
    const arrayCacheValue = clientCache.getCacheFromSelection(selectionArg);
    if (innerState.allowCache && arrayCacheValue === null) return null;

    const proxyValue: unknown[] =
      arrayCacheValue === CacheNotFound || !Array.isArray(arrayCacheValue)
        ? proxySymbolArray
        : arrayCacheValue;

    return accessorCache.getArrayAccessor(selectionArg, proxyValue, () => {
      return new Proxy(proxyValue, {
        get(target, key: string, receiver) {
          let index: number | undefined;

          try {
            index = parseInt(key);
          } catch (err) {}

          if (isInteger(index)) {
            if (
              innerState.allowCache &&
              arrayCacheValue !== CacheNotFound &&
              arrayCacheValue[index] == null
            ) {
              /**
               * If cache is enabled and arrayCacheValue[index] is 'null' or 'undefined', return it
               */
              return arrayCacheValue[index];
            }

            const selection = selectionManager.getSelection({
              key: index,
              prevSelection: selectionArg,
            });
            return createAccessor(schemaType, selection);
          }

          return Reflect.get(target, key, receiver);
        },
      });
    });
  }

  function createAccessor(schemaType: Schema[string], selectionArg: Selection) {
    const cacheValue = clientCache.getCacheFromSelection(selectionArg);
    if (innerState.allowCache && cacheValue === null) return null;

    return accessorCache.getAccessor(selectionArg, () => {
      return new Proxy(
        fromPairs(
          Object.keys(schemaType).map((key) => {
            return [key, ProxySymbol];
          })
        ) as Record<string, unknown>,
        {
          get(target, key: string, receiver) {
            if (!schemaType.hasOwnProperty(key))
              return Reflect.get(target, key, receiver);

            const { __type, __args } = schemaType[key];
            const { pureType, isArray } = parseSchemaType(__type);

            const resolve = (args?: {
              argValues: Record<string, unknown>;
              argTypes: Record<string, string>;
            }): unknown => {
              const selection = selectionManager.getSelection({
                key,
                prevSelection: selectionArg,
                args: args != null ? args.argValues : undefined,
                argTypes: args != null ? args.argTypes : undefined,
              });

              if (scalarsEnumsHash[pureType]) {
                const cacheValue = clientCache.getCacheFromSelection(selection);

                if (cacheValue === CacheNotFound) {
                  // If cache was not found, add the selections to the queue
                  interceptorManager.addSelection(selection);

                  innerState.foundValidCache = false;
                  return null;
                }

                if (!innerState.allowCache) {
                  // Or if you are making the network fetch always
                  interceptorManager.addSelection(selection);
                }

                return cacheValue;
              }

              const typeValue = schema[pureType];
              if (typeValue) {
                if (isArray) {
                  return createArrayAccessor(typeValue, selection);
                }
                return createAccessor(typeValue, selection);
              }

              throw Error('GraphQL Type not found!');
            };

            if (__args) {
              return function ProxyFn(argValues: Record<string, unknown> = {}) {
                return resolve({
                  argValues,
                  argTypes: __args,
                });
              };
            }

            return resolve();
          },
        }
      );
    });
  }

  function isProxyLike(v: any): v is object {
    return typeof v === 'object' && v !== null;
  }

  function selectFields<A extends object | null | undefined>(
    accessor: A,
    fields: '*' | Array<string | number> = '*',
    recursionDepth = 1
  ): A {
    if (accessor == null) return accessor as A;

    if (Array.isArray(accessor)) {
      return accessor.map((value) =>
        selectFields(value, fields, recursionDepth)
      ) as A;
    }

    if (!isProxyLike(accessor)) return accessor;

    if (fields.length === 0) {
      return {} as A;
    }

    if (typeof fields === 'string') {
      if (recursionDepth > 0) {
        const allAccessorKeys = Object.keys(accessor);
        return allAccessorKeys.reduce((acum, fieldName) => {
          if (fieldName === '__typename') return acum;

          const fieldValue: unknown = lodashGet(accessor, fieldName);

          if (Array.isArray(fieldValue)) {
            lodashSet(
              acum,
              fieldName,
              fieldValue.map((value) => {
                return selectFields(value, '*', recursionDepth - 1);
              })
            );
          } else if (isProxyLike(fieldValue)) {
            lodashSet(
              acum,
              fieldName,
              selectFields(fieldValue, '*', recursionDepth - 1)
            );
          } else {
            lodashSet(acum, fieldName, fieldValue);
          }
          return acum;
        }, {} as NonNullable<A>);
      } else {
        return null as A;
      }
    }

    return fields.reduce((acum, fieldName) => {
      const fieldValue = lodashGet(accessor, fieldName, CacheNotFound);

      if (fieldValue === CacheNotFound) return acum;

      if (Array.isArray(fieldValue)) {
        lodashSet(
          acum,
          fieldName,
          fieldValue.map((value) => {
            return selectFields(value, '*', recursionDepth);
          })
        );
      } else if (isProxyLike(fieldValue)) {
        lodashSet(
          acum,
          fieldName,
          selectFields(fieldValue, '*', recursionDepth)
        );
      } else {
        lodashSet(acum, fieldName, fieldValue);
      }

      return acum;
    }, {} as NonNullable<A>);
  }

  function createSchemaAccesor() {
    return (new Proxy(
      {
        query: ProxySymbol,
        mutation: ProxySymbol,
        subscription: ProxySymbol,
      },
      {
        get(target, key: string, receiver) {
          const value = schema[key];

          if (value) {
            let type: SelectionType;
            switch (key) {
              case 'subscription': {
                type = SelectionType.Subscription;
                break;
              }
              case 'mutation': {
                type = SelectionType.Mutation;
                break;
              }
              default: {
                type = SelectionType.Query;
              }
            }
            const selection = selectionManager.getSelection({
              key,
              type,
            });

            return createAccessor(value, selection);
          }

          return Reflect.get(target, key, receiver);
        },
      }
    ) as unknown) as GeneratedSchema;
  }

  const query: GeneratedSchema['query'] = client.query;
  const mutation: GeneratedSchema['mutation'] = client.mutation;
  const subscription: GeneratedSchema['subscription'] = client.subscription;

  return {
    query,
    mutation,
    subscription,
    resolved,
    selectFields,
    cache: clientCache.cache,
    interceptorManager,
    scheduler,
    refetch,
    accessorCache,
    buildAndFetchSelections,
    eventHandler,
  };
}
