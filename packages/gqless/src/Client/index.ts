import fromPairs from 'lodash/fromPairs';

import { CacheNotFound, createCache } from '../Cache';
import { InterceptorManager } from '../Interceptor';
import { buildQuery } from '../QueryBuilder';
import { Scheduler } from '../Scheduler';
import {
  parseSchemaType,
  QueryFetcher,
  ScalarsEnumsHash,
  Schema,
} from '../Schema/types';
import { AliasManager } from '../Selection/AliasManager';
import {
  Selection,
  SelectionType,
  separateSelectionTypes,
} from '../Selection/selection';
import { SelectionManager } from '../Selection/SelectionManager';

const ProxySymbol = Symbol('gqless-proxy');

export function createClient<GeneratedSchema = never>(
  schema: Readonly<Schema>,
  scalarsEnumsHash: ScalarsEnumsHash,
  queryFetcher: QueryFetcher,
  {}: { isProduction?: boolean } = {}
) {
  const aliasManager = new AliasManager();

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

  new SelectionManager();

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
          Error.captureStackTrace(err, resolveAllSelections);
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

            const selection = new Selection({
              key: index,
              prevSelection: selectionsArg,
              aliasManager,
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
            const selection = new Selection({
              key,
              prevSelection: selectionsArg,
              isArray,
              aliasManager,
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
            return (argValues: Record<string, unknown> = {}) => {
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
  }

  function createSchemaAccesor() {
    return new Proxy(
      fromPairs(
        Object.keys(schema).map((key) => {
          return [key, ProxySymbol];
        })
      ) as Record<string, unknown>,
      {
        get(target, key: string, receiver) {
          if (!schema.hasOwnProperty(key))
            return Reflect.get(target, key, receiver);

          const value = schema[key];

          if (value) {
            const selection = new Selection({
              key,
              aliasManager,
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
    ) as GeneratedSchema;
  }

  return {
    client,
    resolveAllSelections,
    resolved,
  };
}
