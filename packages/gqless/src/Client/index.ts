import { CacheNotFound, createCache } from "../Cache";
import { Interceptor } from "../Interceptor";
import { buildQuery } from "../QueryBuilder";
import { AliasManager } from "../Selection/AliasManager";
import { Selection } from "../Selection/selection";
import { QueryFetcher, ScalarsHash, Schema } from "../types";

const ProxySymbol = Symbol("gqless-proxy");

export function createClient<GeneratedSchema = never>(
  schema: Readonly<Schema>,
  scalars: ScalarsHash,
  queryFetcher: QueryFetcher
) {
  const aliasManager = new AliasManager();

  const ProxyCache = new WeakMap<Selection, object>();

  const interceptors = new Set<Interceptor>();

  const globalInterceptor = new Interceptor();
  interceptors.add(globalInterceptor);

  const client: GeneratedSchema = createSchemaAccesor();
  const { getCacheFromSelection, mergeCache } = createCache();

  let allowCache = true;

  async function resolved<T = unknown>(
    dataFn: () => T,
    {
      refetch,
    }: {
      refetch?: boolean;
    } = {}
  ): Promise<T> {
    const interceptor = new Interceptor();
    interceptors.add(interceptor);
    const prevIgnoreCache = allowCache;
    if (refetch) {
      allowCache = false;
    }
    try {
      const data = dataFn();

      if (interceptor.selections.size === 0) {
        return data;
      }

      allowCache = prevIgnoreCache;

      await resolveSelections(interceptor.selections);

      allowCache = true;

      return dataFn();
    } finally {
      interceptors.delete(interceptor);
      allowCache = prevIgnoreCache;
    }
  }

  async function resolveSelections(selections: Selection[] | Set<Selection>) {
    const { query, variables } = buildQuery(selections);

    const { data, errors } = await queryFetcher(query, variables);

    if (data) {
      mergeCache(data);

      for (const interceptor of interceptors) {
        interceptor.removeSelections(selections);
      }
    }

    if (errors) {
      console.error(errors);
      const err = Error("Errors in resolve");

      if (Error.captureStackTrace) {
        Error.captureStackTrace(err, resolveAllSelections);
      }

      throw err;
    }
  }

  function resolveAllSelections() {
    if (globalInterceptor.selections.size) {
      return resolveSelections(globalInterceptor.selections);
    }

    return Promise.resolve();
  }

  function createArrayAccessor(schemaType: Schema[string], selectionsArg: Selection) {
    const arrayCacheValue = getCacheFromSelection(selectionsArg);
    if (allowCache && arrayCacheValue === null) return null;

    let proxy = ProxyCache.get(selectionsArg);

    if (!proxy) {
      proxy = new Proxy(
        arrayCacheValue === CacheNotFound ? [ProxySymbol] : (arrayCacheValue as unknown[]),
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

      ProxyCache.set(selectionsArg, proxy);
    }
    return proxy;
  }

  function createAccessor(schemaType: Schema[string], selectionsArg: Selection) {
    const cacheValue = getCacheFromSelection(selectionsArg);
    if (allowCache && cacheValue === null) return null;

    let proxy = ProxyCache.get(selectionsArg);

    if (!proxy) {
      proxy = new Proxy(
        Object.fromEntries(
          Object.keys(schemaType).map((key) => {
            return [key, ProxySymbol];
          })
        ) as Record<string, unknown>,
        {
          get(target, key: string, receiver) {
            if (!schemaType.hasOwnProperty(key)) return Reflect.get(target, key, receiver);

            const value = schemaType[key];
            if (value) {
              const { __type, __args } = value;

              const { pureType, isArray } = (() => {
                let isNullable = true;
                let nullableItems = true;
                let isArray = false;
                let pureType = __type;
                if (__type.endsWith("!")) {
                  isNullable = false;
                  pureType = __type.slice(0, __type.length - 1);
                }
                if (pureType.startsWith("[")) {
                  pureType = pureType.slice(1, pureType.length - 1);
                  isArray = true;
                  if (pureType.endsWith("!")) {
                    nullableItems = false;
                    pureType = pureType.slice(0, pureType.length - 1);
                  }
                }

                return {
                  pureType,
                  isNullable,
                  nullableItems,
                  isArray,
                };
              })();

              const selection = new Selection({
                key,
                prevSelection: selectionsArg,
                isArray,
                aliasManager,
              });

              const resolve = (): unknown => {
                if (scalars[pureType]) {
                  const cacheValue = getCacheFromSelection(selection);

                  if (cacheValue === CacheNotFound) {
                    // If cache was not found, add the selections to the queue
                    for (const interceptor of interceptors) {
                      interceptor.addSelection(selection);
                    }

                    return null;
                  }

                  if (!allowCache) {
                    // Or if you are making the network fetch always
                    for (const interceptor of interceptors) {
                      interceptor.addSelection(selection);
                    }
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

                throw Error("97 Not found!");
              };

              if (__args) {
                return (args: typeof __args) => {
                  selection.args = args;
                  selection.argTypes = __args;

                  return resolve();
                };
              }

              return resolve();
            }
            console.error("Not found", key);

            throw Error(`83. Not found`);
          },
        }
      );
      ProxyCache.set(selectionsArg, proxy);
    }

    return proxy;
  }

  function createSchemaAccesor() {
    return new Proxy(
      Object.fromEntries(
        Object.keys(schema).map((key) => {
          return [key, ProxySymbol];
        })
      ) as Record<string, unknown>,
      {
        get(_target, key: string, _receiver) {
          const value = schema[key];

          if (value) {
            const selection = new Selection({
              key,
              aliasManager,
            });

            return createAccessor(value, selection);
          }
          throw Error("104. Not found");
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
