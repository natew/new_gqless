import fromPairs from 'lodash/fromPairs';
import lodashGet from 'lodash/get';
import lodashSet from 'lodash/set';

import { CacheNotFound, createAccessorCache, createCache } from '../Cache';
import { InterceptorManager } from '../Interceptor';
import { buildQuery } from '../QueryBuilder';
import { Scheduler } from '../Scheduler';
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

export function createClient<GeneratedSchema = never>(
  schema: Readonly<Schema>,
  scalarsEnumsHash: ScalarsEnumsHash,
  queryFetcher: QueryFetcher,
  {}: { isProduction?: boolean } = {}
) {
  const interceptorManager = new InterceptorManager();

  const globalInterceptor = interceptorManager.globalInterceptor;

  const client: GeneratedSchema = createSchemaAccesor();
  let clientCache = createCache();

  let allowCache = true;

  function resolveAllSelections() {
    if (globalInterceptor.selections.size) {
      return resolveSelections(globalInterceptor.selections);
    }

    return Promise.resolve();
  }

  const selectionManager = new SelectionManager();

  const accessorCache = createAccessorCache();

  new Scheduler(interceptorManager, resolveAllSelections);

  async function resolved<T = unknown>(
    dataFn: () => T,
    {
      refetch,
      noCache,
    }: {
      refetch?: boolean;
      noCache?: boolean;
    } = {}
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
        console.error(errors);
        const err = Error('Errors in resolve');

        if (Error.captureStackTrace) {
          Error.captureStackTrace(err, buildAndFetchSelections);
        }

        throw err;
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

    return accessorCache.getAccessor(selectionsArg, () => {
      return new Proxy(
        arrayCacheValue === CacheNotFound
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
              });
              return createAccessor(schemaType, selection);
            }

            return Reflect.get(target, key, receiver);
          },
        }
      );
    });
  }

  type AccessorFn = {
    (argValues?: Record<string, unknown>): unknown;
    onlyNullableArgs?: boolean;
  };

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
                isArray,
                args: args != null ? args.argValues : undefined,
                argTypes: args != null ? args.argTypes : undefined,
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

              throw Error('Not found!');
            };

            if (__args) {
              const fnResolve: AccessorFn = function (
                argValues: Record<string, unknown> = {}
              ) {
                return resolve({
                  argValues,
                  argTypes: __args,
                });
              };

              fnResolve.onlyNullableArgs = Object.entries(__args).every(
                ([, argType]) => {
                  return !argType.endsWith('!');
                }
              );

              return fnResolve;
            }

            return resolve();
          },
        }
      );
    });
  }

  function selectFields<A extends object>(
    accessor: A,
    fields: '*' | Array<string | number> = '*',
    recursionDepth = 1
  ) {
    let prevAllowCache = allowCache;

    try {
      if (!Array.isArray(fields)) {
        fields = [fields];
      } else if (fields.length === 0) {
        return {} as A;
      }

      allowCache = false;

      if (fields[0] === '*') {
        if (recursionDepth > 0) {
          const allAccessorKeys = Object.keys(accessor);
          return allAccessorKeys.reduce((acum, fieldName) => {
            const fieldValue: unknown = lodashGet(accessor, fieldName);
            if (typeof fieldValue === 'function') {
              if ((fieldValue as AccessorFn).onlyNullableArgs) {
                const returnedValue: unknown = fieldValue();
                if (accessorCache.isProxy(returnedValue)) {
                  const selection = accessorCache.getProxySelection(
                    returnedValue
                  );
                  lodashSet(
                    acum,
                    selection?.alias || fieldName,
                    selectFields(returnedValue, '*', recursionDepth - 1)
                  );
                } else {
                  lodashSet(acum, fieldName, returnedValue);
                }
              }
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
          return {} as A;
        }
      }

      return fields.reduce((acum, fieldName) => {
        const fieldValue = lodashGet(accessor, fieldName);

        if (typeof fieldValue === 'function') {
          if ((fieldValue as AccessorFn).onlyNullableArgs) {
            const returnedValue = fieldValue();
            if (!accessorCache.isProxy(returnedValue)) {
              lodashSet(acum, fieldName, returnedValue);
            }
          }
        } else if (!accessorCache.isProxy(fieldValue)) {
          lodashSet(acum, fieldName, fieldValue);
        }

        return acum;
      }, {} as A);
    } finally {
      allowCache = prevAllowCache;
    }
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
          if (!schema.hasOwnProperty(key))
            return Reflect.get(target, key, receiver);

          const value = schema[key];

          if (value) {
            const selection = selectionManager.getSelection({
              key,
              type: (() => {
                switch (key) {
                  case 'subscription': {
                    return SelectionType.Subscription;
                  }
                  case 'mutation': {
                    return SelectionType.Mutation;
                  }
                  case 'query': {
                    return SelectionType.Query;
                  }
                  default: {
                    throw Error('Not expected schema type');
                  }
                }
              })(),
            });

            return createAccessor(value, selection);
          }

          return Reflect.get(target, key, receiver);
        },
      }
    ) as unknown) as GeneratedSchema;
  }

  return {
    client,
    resolved,
    selectFields,
  };
}
