import fromPairs from 'lodash/fromPairs';
import { CacheNotFound } from '../Cache';
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
    eventHandler,
  } = innerState;

  const ProxySymbol = Symbol('gqless-proxy');

  const ResolveInfoSymbol = Symbol();

  interface ResolveInfo {
    key: string | number;
    prevSelection: Selection;
    argTypes: Record<string, string> | undefined;
  }

  const proxySymbolArray = [ProxySymbol];

  function extractDataFromProxy(value: unknown): unknown {
    if (accessorCache.isProxy(value)) {
      const accessorSelection = accessorCache.getProxySelection(value);

      // An edge case hard to reproduce
      /* istanbul ignore if */
      if (!accessorSelection) {
        return undefined;
      }

      const selectionCache = innerState.clientCache.getCacheFromSelection(
        accessorSelection
      );

      if (selectionCache === CacheNotFound) {
        return undefined;
      }
      return selectionCache;
    } else {
      return value;
    }
  }

  function setCache<A extends object>(
    accessor: A,
    data: DeepPartial<A> | null | undefined
  ): void;
  function setCache<B extends (args?: any) => unknown>(
    accessor: B,
    args: Parameters<B>['0'],
    data: DeepPartial<ReturnType<B>> | null | undefined
  ): void;
  function setCache(
    accessor: unknown,
    dataOrArgs: Record<string, unknown> | unknown,
    possibleData?: unknown
  ) {
    if (typeof accessor === 'function') {
      if (dataOrArgs !== undefined && typeof dataOrArgs !== 'object') {
        const err = Error('Invalid arguments of type: ' + typeof dataOrArgs);
        /* istanbul ignore else */
        if (Error.captureStackTrace!) {
          Error.captureStackTrace(err, setCache);
        }
        throw err;
      }

      const resolveInfo = (accessor as Function & {
        [ResolveInfoSymbol]?: ResolveInfo;
      })[ResolveInfoSymbol];

      if (!resolveInfo) {
        const err = Error('Invalid gqless function');

        /* istanbul ignore else */
        if (Error.captureStackTrace!) {
          Error.captureStackTrace(err, setCache);
        }

        throw err;
      }

      const selection = selectionManager.getSelection({
        ...resolveInfo,
        args: dataOrArgs as Record<string, unknown>,
      });

      const data = extractDataFromProxy(possibleData);

      innerState.clientCache.setCacheFromSelection(selection, data);
      eventHandler.sendCacheChange({
        data,
        selection,
      });
    } else if (accessorCache.isProxy(accessor)) {
      const selection = accessorCache.getProxySelection(accessor);

      // An edge case hard to reproduce
      /* istanbul ignore if */
      if (!selection) {
        const err = Error('Invalid proxy selection');

        if (Error.captureStackTrace!) {
          Error.captureStackTrace(err, setCache);
        }

        throw err;
      }

      const data = extractDataFromProxy(dataOrArgs);

      innerState.clientCache.setCacheFromSelection(selection, data);
      eventHandler.sendCacheChange({
        data,
        selection,
      });
    } else {
      const err = Error('Invalid gqless proxy');

      /* istanbul ignore else */
      if (Error.captureStackTrace!) {
        Error.captureStackTrace(err, setCache);
      }

      throw err;
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
          set(_target, key: string, value: unknown) {
            let index: number | undefined;

            try {
              index = parseInt(key);
            } catch (err) {}

            if (isInteger(index)) {
              const selection = selectionManager.getSelection({
                key: index,
                prevSelection: selectionArg,
              });

              const data = extractDataFromProxy(value);

              innerState.clientCache.setCacheFromSelection(selection, data);

              eventHandler.sendCacheChange({
                selection,
                data,
              });

              return true;
            }

            throw TypeError('Invalid array assignation');
          },
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
          set(_target, key: string, value: unknown) {
            if (!schemaType.hasOwnProperty(key)) {
              throw TypeError('Invalid proxy assignation');
            }

            const targetSelection = selectionManager.getSelection({
              key,
              prevSelection: selectionArg,
            });

            const data = extractDataFromProxy(value);

            innerState.clientCache.setCacheFromSelection(targetSelection, data);
            eventHandler.sendCacheChange({
              data,
              selection: targetSelection,
            });

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

                accessorCache.addSelectionToAccessorHistory(
                  accessor,
                  selection
                );

                if (cacheValue === CacheNotFound) {
                  // If cache was not found, add the selections to the queue
                  interceptorManager.addSelection(selection);

                  innerState.foundValidCache = false;
                  return null;
                }

                if (!innerState.allowCache) {
                  // Or if you are making the network fetch always
                  interceptorManager.addSelection(selection);
                } else {
                  // For the subscribers of data changes
                  interceptorManager.addSelectionCache(selection);
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
              const resolveInfo: ResolveInfo = {
                key,
                prevSelection: selectionArg,
                argTypes: __args,
              };

              return Object.assign(
                function ProxyFn(argValues: Record<string, unknown> = {}) {
                  return resolve({
                    argValues,
                    argTypes: __args,
                  });
                },
                {
                  [ResolveInfoSymbol]: resolveInfo,
                }
              );
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

    setCache,
  };
}
