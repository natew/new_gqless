import fromPairs from 'lodash/fromPairs';
import { CacheNotFound, ProxyAccessor } from '../Cache';
import { InnerClientState } from '../Client/client';
import { DeepPartial, parseSchemaType, Schema } from '../Schema';
import { Selection, SelectionType } from '../Selection';
import { isInteger } from '../Utils';

export function AccessorCreators<
  GeneratedSchema extends {
    query: {};
    mutation: {};
    subscription: {};
  } = never
>(innerState: InnerClientState) {
  const {
    accessorCache,
    selectionManager,
    interceptorManager,
    scalarsEnumsHash,
    schema,
  } = innerState;

  const ProxySymbol = Symbol('gqless-proxy');

  const proxySymbolArray = [ProxySymbol];

  function setAccessorCache<A>(
    accessor: A,
    data: DeepPartial<A> | null | undefined
  ) {
    if (accessorCache.isProxy(accessor)) {
      const selection = accessorCache.getProxySelection(accessor);
      if (selection) {
        innerState.clientCache.setCacheFromSelection(selection, data);
      }
    }
  }

  function createArrayAccessor(
    schemaType: Schema[string],
    selectionArg: Selection
  ) {
    const arrayCacheValue = innerState.clientCache.getCacheFromSelection(
      selectionArg
    );
    if (innerState.allowCache && arrayCacheValue === null) return null;

    const proxyValue: unknown[] =
      arrayCacheValue === CacheNotFound || !Array.isArray(arrayCacheValue)
        ? proxySymbolArray
        : arrayCacheValue;

    const accessor = accessorCache.getArrayAccessor(
      selectionArg,
      proxyValue,
      () => {
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
              const childAccessor = createAccessor(schemaType, selection);

              accessorCache.addAccessorChild(accessor, childAccessor);

              return childAccessor;
            }

            return Reflect.get(target, key, receiver);
          },
        });
      }
    );

    return accessor;
  }

  function createAccessor(schemaType: Schema[string], selectionArg: Selection) {
    const cacheValue = innerState.clientCache.getCacheFromSelection(
      selectionArg
    );
    if (innerState.allowCache && cacheValue === null) return null;

    const accessor = accessorCache.getAccessor(selectionArg, () => {
      return new Proxy(
        fromPairs(
          Object.keys(schemaType).map((key) => {
            return [key, ProxySymbol];
          })
        ) as Record<string, unknown>,
        {
          set(_target: ProxyAccessor, key: string, value, _receiver) {
            if (!schemaType.hasOwnProperty(key)) return false;

            const targetSelection = selectionManager.getSelection({
              key,
              prevSelection: selectionArg,
            });

            if (accessorCache.isProxy(value)) {
              const accessorSelection = accessorCache.getProxySelection(value);

              if (!accessorSelection) return true;

              const selectionCache = innerState.clientCache.getCacheFromSelection(
                accessorSelection
              );

              if (selectionCache === CacheNotFound) return true;

              innerState.clientCache.setCacheFromSelection(
                targetSelection,
                selectionCache
              );
            } else {
              innerState.clientCache.setCacheFromSelection(
                targetSelection,
                value
              );
            }

            return true;
          },
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
                const cacheValue = innerState.clientCache.getCacheFromSelection(
                  selection
                );

                if (cacheValue === CacheNotFound) {
                  // If cache was not found, add the selections to the queue
                  interceptorManager.addSelection(selection);
                  accessorCache.addSelectionToAccessorHistory(
                    accessor,
                    selection
                  );

                  innerState.foundValidCache = false;
                  return null;
                }

                if (!innerState.allowCache) {
                  // Or if you are making the network fetch always
                  interceptorManager.addSelection(selection);
                  accessorCache.addSelectionToAccessorHistory(
                    accessor,
                    selection
                  );
                }

                return cacheValue;
              }

              const typeValue = schema[pureType];
              if (typeValue) {
                const childAccessor = isArray
                  ? createArrayAccessor(typeValue, selection)
                  : createAccessor(typeValue, selection);

                accessorCache.addAccessorChild(accessor, childAccessor);

                return childAccessor;
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
    return accessor;
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

  return {
    createAccessor,
    createArrayAccessor,
    createSchemaAccesor,
    setAccessorCache,
  };
}
