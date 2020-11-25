import { GraphQLError } from 'graphql/error';
import fromPairs from 'lodash/fromPairs';
import lodashGet from 'lodash/get';
import lodashSet from 'lodash/set';

import { CacheNotFound, createAccessorCache, createCache } from '../Cache';
import { gqlessError } from '../Error';
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

const ProxySymbol = Symbol('gqless-proxy');

export interface GraphQLErrorsContainer extends Error {
  errors: readonly GraphQLError[];
}

export interface ResolveOptions {
  refetch?: boolean;
  noCache?: boolean;
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

  let allowCache = true;

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
    { refetch, noCache }: ResolveOptions = {}
  ): Promise<T> {
    globalInterceptor.listening = false;
    const interceptor = interceptorManager.createInterceptor();

    const prevIgnoreCache = allowCache;
    if (refetch) {
      allowCache = false;
    }
    const globalCache = clientCache;
    let tempCache: typeof clientCache | undefined;
    if (noCache) {
      clientCache = tempCache = createCache();
    }
    try {
      const data = dataFn();

      if (interceptor.selections.size === 0) {
        return data;
      }

      allowCache = prevIgnoreCache;
      clientCache = globalCache;
      globalInterceptor.listening = true;

      await resolveSelections(interceptor.selections, tempCache || clientCache);

      allowCache = true;
      globalInterceptor.listening = false;

      if (tempCache) {
        clientCache = tempCache;
      }

      return dataFn();
    } catch (err) {
      if (err instanceof Error) {
        /* istanbul ignore else */
        if (Error.captureStackTrace!) {
          Error.captureStackTrace(err, resolved);
        }

        if (!(err instanceof gqlessError)) {
          const newError = new gqlessError(err.message, { networkError: err });

          /* istanbul ignore else */
          if (Error.captureStackTrace!) {
            Error.captureStackTrace(newError, resolved);
          }

          throw newError;
        }
      }
      throw err;
    } finally {
      interceptorManager.removeInterceptor(interceptor);

      allowCache = prevIgnoreCache;
      clientCache = globalCache;
      globalInterceptor.listening = true;
    }
  }

  async function refetch<T = undefined | void>(refetchFn: () => T) {
    const startSelectionsSize =
      interceptorManager.globalInterceptor.selections.size;

    const prevIgnoreCache = allowCache;

    try {
      allowCache = false;
      const data = refetchFn();

      if (
        interceptorManager.globalInterceptor.selections.size ===
        startSelectionsSize
      ) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Warning: No selections made!');
        }
        return data;
      }

      allowCache = prevIgnoreCache;

      await scheduler.resolving!.promise;

      allowCache = true;

      return refetchFn();
    } finally {
      allowCache = prevIgnoreCache;
    }
  }

  async function buildAndFetchSelections(
    selections: Selection[],
    cache: typeof clientCache,
    type: 'query' | 'mutation' | 'subscription'
  ) {
    if (selections.length === 0) return;

    try {
      const { query, variables } = buildQuery(selections, {
        type,
      });

      const { data, errors } = await queryFetcher(query, variables);

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

    await Promise.all([
      buildAndFetchSelections(querySelections, cache, 'query'),
      buildAndFetchSelections(mutationSelections, cache, 'mutation'),
      buildAndFetchSelections(subscriptionSelections, cache, 'subscription'),
    ]);
  }

  const proxySymbolArray = [ProxySymbol];

  function createArrayAccessor(
    schemaType: Schema[string],
    selectionArg: Selection
  ) {
    const arrayCacheValue = clientCache.getCacheFromSelection(selectionArg);
    if (allowCache && arrayCacheValue === null) return null;

    const proxyValue: unknown[] =
      arrayCacheValue === CacheNotFound || !Array.isArray(arrayCacheValue)
        ? proxySymbolArray
        : arrayCacheValue;

    return accessorCache.getArrayAccessor(selectionArg, proxyValue, () => {
      return new Proxy(proxyValue, {
        get(target, key: string, receiver) {
          const index = parseInt(key);

          if (Number.isInteger(index)) {
            if (
              allowCache &&
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
              allowCache,
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
    if (allowCache && cacheValue === null) return null;

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
                allowCache,
              });

              if (scalarsEnumsHash[pureType]) {
                const cacheValue = clientCache.getCacheFromSelection(selection);

                if (cacheValue === CacheNotFound) {
                  // If cache was not found, add the selections to the queue
                  interceptorManager.addSelection(selection);

                  return null;
                }

                if (!allowCache) {
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
      } else if (accessorCache.isProxy(fieldValue)) {
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
              allowCache,
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
  };
}
