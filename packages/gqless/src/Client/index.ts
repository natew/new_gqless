import { GraphQLError } from 'graphql/error';
import fromPairs from 'lodash/fromPairs';
import lodashGet from 'lodash/get';
import lodashSet from 'lodash/set';

import { CacheNotFound, createAccessorCache, createCache } from '../Cache';
import { createInterceptorManager } from '../Interceptor';
import { buildQuery } from '../QueryBuilder';
import { createScheduler } from '../Scheduler';
import {
  DeepPartial,
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

  function resolveAllSelections() {
    return resolveSelections(globalInterceptor.selections).catch((err) => {
      // TODO: Improve error handling customization
      console.error(err);
    });
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
      /* istanbul ignore else */
      if (err instanceof Error) {
        /* istanbul ignore else */
        if (Error.captureStackTrace!) {
          Error.captureStackTrace(err, resolved);
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

      if (data) {
        cache.mergeCache(data);
      }

      if (errors) {
        if (errors.length > 1) {
          const err: GraphQLErrorsContainer = Object.assign(
            Error(`Errors in GraphQL ${type}, check .errors property`),
            {
              errors,
            }
          );

          throw err;
        } else {
          const error = Object.assign(Error(), errors[0]);

          throw error;
        }
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

  function createArrayAccessor(
    schemaType: Schema[string],
    selectionsArg: Selection
  ) {
    const arrayCacheValue = clientCache.getCacheFromSelection(selectionsArg);
    if (allowCache && arrayCacheValue === null) return null;

    return new Proxy(
      arrayCacheValue === CacheNotFound || !Array.isArray(arrayCacheValue)
        ? [ProxySymbol]
        : (arrayCacheValue as unknown[]),
      {
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
              prevSelection: selectionsArg,
              allowCache,
            });
            return createAccessor(schemaType, selection);
          }

          return Reflect.get(target, key, receiver);
        },
      }
    );
  }

  function createAccessor(
    schemaType: Schema[string],
    selectionsArg: Selection
  ) {
    const cacheValue = clientCache.getCacheFromSelection(selectionsArg);
    if (allowCache && cacheValue === null) return null;

    return accessorCache.getAccessor(selectionsArg, () => {
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
                prevSelection: selectionsArg,
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

  function selectFields<A extends object | null | undefined>(
    accessor: A,
    fields?: '*',
    recursionDepth?: number
  ): A;
  function selectFields<A extends object | null | undefined>(
    accessor: A,
    fields: Array<string | number>,
    recursionDepth?: number
  ): DeepPartial<A>;
  function selectFields<A extends object>(
    accessor: A | null | undefined,
    fields: '*' | Array<string | number> = '*',
    recursionDepth = 1
  ) {
    if (accessor == null) return accessor;

    if (Array.isArray(accessor)) {
      return accessor.map((value) =>
        selectFields(value, fields as any, recursionDepth)
      );
    }

    if (!accessorCache.isProxy(accessor)) return accessor;

    if (fields.length === 0) {
      return {} as A;
    }

    if (fields === '*') {
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
          } else if (accessorCache.isProxy(fieldValue)) {
            lodashSet(
              acum,
              fieldName,
              selectFields(fieldValue, '*', recursionDepth - 1)
            );
          } else {
            lodashSet(acum, fieldName, fieldValue);
          }
          return acum;
        }, {} as A);
      } else {
        return null;
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
    }, {} as A);
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
  };
}
