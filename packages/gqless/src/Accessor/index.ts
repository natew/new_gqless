import { CacheNotFound } from '../Cache';
import { InnerClientState } from '../Client/client';
import { gqlessError } from '../Error';
import {
  DeepPartial,
  parseSchemaType,
  Schema,
  SchemaUnionsKey,
  Type,
} from '../Schema';
import { Selection, SelectionType } from '../Selection';
import { isInteger, isObject } from '../Utils';

const ProxySymbol = Symbol('gqless-proxy');

export class SchemaUnion {
  /** union name */
  name!: string;
  types!: Record<
    /** object type name */
    string,
    /** schema type of object type */
    Record<string, Type>
  >;
  /**
   * Proxy target, pre-made for performance
   */
  fieldsProxy!: Record<string, typeof ProxySymbol>;
  fieldsMap!: Record<
    /** field name */
    string,
    /** list of object types (with it's schema type)
     * that has the field name */
    {
      list: { objectTypeName: string; type: Record<string, Type> }[];
      typesNames: string[];
      combinedTypes: Record<string, Type>;
    }
  >;
  combinedTypes!: Record<string, Type>;
}

export function createSchemaUnions(schema: Readonly<Schema>) {
  const unionObjectTypesForSelections: Record<string, [string]> = {};

  const unions = Object.entries(
    schema[SchemaUnionsKey] /* istanbul ignore next */ || {}
  ).reduce((acum, [name, unionTypes]) => {
    const fieldsSet = new Set<string>();
    const fieldsMap: SchemaUnion['fieldsMap'] = {};

    const combinedTypes: Record<string, Type> = {};

    const types = unionTypes.reduce((typeAcum, objectTypeName) => {
      unionObjectTypesForSelections[objectTypeName] ||= [objectTypeName];
      const objectType = schema[objectTypeName];
      /* istanbul ignore else */
      if (objectType) {
        for (const objectTypeFieldName of Object.keys(objectType)) {
          fieldsMap[objectTypeFieldName] ||= {
            list: [],
            typesNames: [],
            combinedTypes: {},
          };
          fieldsMap[objectTypeFieldName].list.push({
            type: objectType,
            objectTypeName,
          });
          Object.assign(
            fieldsMap[objectTypeFieldName].combinedTypes,
            objectType
          );
          Object.assign(combinedTypes, objectType);
          fieldsSet.add(objectTypeFieldName);
        }

        typeAcum[objectTypeName] = objectType;
      }
      return typeAcum;
    }, {} as SchemaUnion['types']);

    for (const fieldMapValue of Object.values(fieldsMap)) {
      fieldMapValue.typesNames = fieldMapValue.list.map(
        (v) => v.objectTypeName
      );
    }

    acum[name] = Object.assign(new SchemaUnion(), {
      name,
      types,
      fieldsProxy: Array.from(fieldsSet).reduce((fieldsAcum, fieldName) => {
        fieldsAcum[fieldName] = ProxySymbol;
        return fieldsAcum;
      }, {} as SchemaUnion['fieldsProxy']),
      fieldsMap,
      combinedTypes,
    });

    return acum;
  }, {} as Record<string, SchemaUnion>);

  return {
    unions,
    unionObjectTypesForSelections,
  };
}

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
    schemaUnions: { unions: schemaUnions, unionObjectTypesForSelections },
  } = innerState;

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
      if (!accessorSelection) return;

      const selectionCache = innerState.clientCache.getCacheFromSelection(
        accessorSelection
      );

      if (selectionCache === CacheNotFound) return;

      return selectionCache;
    } else if (isObject(value)) {
      /**
       * This is necessary to be able to extract data from proxies
       * inside user-made objects and arrays
       */
      return JSON.parse(JSON.stringify(value));
    }
    return value;
  }

  function setCache(selection: Selection, data: unknown): void;
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
    accessorOrSelection: unknown,
    dataOrArgs: unknown,
    possibleData?: unknown
  ) {
    if (accessorOrSelection instanceof Selection) {
      const data = extractDataFromProxy(dataOrArgs);
      innerState.clientCache.setCacheFromSelection(accessorOrSelection, data);
      eventHandler.sendCacheChange({
        data,
        selection: accessorOrSelection,
      });
    } else if (typeof accessorOrSelection === 'function') {
      if (dataOrArgs !== undefined && typeof dataOrArgs !== 'object') {
        throw new gqlessError(
          'Invalid arguments of type: ' + typeof dataOrArgs,
          {
            caller: setCache,
          }
        );
      }

      const resolveInfo = (accessorOrSelection as Function & {
        [ResolveInfoSymbol]?: ResolveInfo;
      })[ResolveInfoSymbol];

      if (!resolveInfo) {
        throw new gqlessError('Invalid gqless function', {
          caller: setCache,
        });
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
    } else if (accessorCache.isProxy(accessorOrSelection)) {
      const selection = accessorCache.getProxySelection(accessorOrSelection);

      // An edge case hard to reproduce
      /* istanbul ignore if */
      if (!selection) {
        throw new gqlessError('Invalid proxy selection', {
          caller: setCache,
        });
      }

      const data = extractDataFromProxy(dataOrArgs);

      innerState.clientCache.setCacheFromSelection(selection, data);
      eventHandler.sendCacheChange({
        data,
        selection,
      });
    } else {
      throw new gqlessError('Invalid gqless proxy', {
        caller: setCache,
      });
    }
  }

  function createArrayAccessor(
    schemaValue: Schema[string] | SchemaUnion,
    selectionArg: Selection,
    unions?: string[]
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
            if (key === 'toJSON')
              return () =>
                innerState.clientCache.getCacheFromSelection(selectionArg, []);

            let index: number | undefined;

            try {
              index = parseInt(key);
            } catch (err) {}

            if (isInteger(index)) {
              const selection = selectionManager.getSelection({
                key: index,
                prevSelection: selectionArg,
              });

              // For the subscribers of data changes
              interceptorManager.addSelectionCache(selection);

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

              const childAccessor = createAccessor(
                schemaValue,
                selection,
                unions
              );

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

  const notFoundObjectKey = {};
  const nullObjectKey = {};

  const unionsCacheValueMap = new WeakMap<string[], WeakMap<object, object>>();

  function getCacheValueReference(
    cacheValue: unknown,
    unions: string[] | undefined
  ) {
    if (unions === undefined) return cacheValue;

    const mapKey: object =
      cacheValue == null
        ? nullObjectKey
        : typeof cacheValue === 'object'
        ? cacheValue!
        : notFoundObjectKey;

    let cacheValueMap = unionsCacheValueMap.get(unions);

    if (!cacheValueMap) {
      cacheValueMap = new WeakMap();
      cacheValueMap.set(unions, mapKey);
    }

    let cacheReference = cacheValueMap.get(mapKey);

    if (!cacheReference) {
      cacheReference = {};
      cacheValueMap.set(mapKey, cacheReference);
    }

    return cacheReference;
  }

  function getTypename(selection: Selection): string | void {
    const cacheValue: unknown = innerState.clientCache.getCacheFromSelection(
      selection
    );
    let typename: string;
    if (
      isObject(cacheValue) &&
      (typename = Reflect.get(cacheValue, '__typename'))
    )
      return typename;

    interceptorManager.addSelection(
      selectionManager.getSelection({
        key: '__typename',
        prevSelection: selection,
      })
    );
  }

  function createAccessor(
    schemaValue: Schema[string] | SchemaUnion,
    selectionArg: Selection,
    unions?: string[]
  ) {
    let cacheValue: unknown = innerState.clientCache.getCacheFromSelection(
      selectionArg
    );
    if (innerState.allowCache && cacheValue === null) return null;

    const accessor = accessorCache.getAccessor(
      selectionArg,
      getCacheValueReference(cacheValue, unions),
      () => {
        const proxyValue =
          schemaValue instanceof SchemaUnion
            ? schemaValue.fieldsProxy
            : Object.keys(schemaValue).reduce((acum, key) => {
                acum[key] = ProxySymbol;
                return acum;
              }, {} as Record<string, unknown>);
        return new Proxy(proxyValue, {
          set(_target, key: string, value: unknown) {
            if (!proxyValue.hasOwnProperty(key))
              throw TypeError('Invalid proxy assignation');

            const targetSelection = selectionManager.getSelection({
              key,
              prevSelection: selectionArg,
              unions,
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
            if (key === 'toJSON')
              return () =>
                innerState.clientCache.getCacheFromSelection(selectionArg, {});

            if (!proxyValue.hasOwnProperty(key))
              return Reflect.get(target, key, receiver);

            if (schemaValue instanceof SchemaUnion) {
              let unionTypeName = getTypename(selectionArg);

              let objectType: Record<string, Type>;

              let selectionUnions: string[];

              if (unionTypeName) {
                objectType = schemaValue.types[unionTypeName];
                selectionUnions = unionObjectTypesForSelections[
                  unionTypeName
                ] /* istanbul ignore next */ || [unionTypeName];
              } else {
                // TODO: Long term fix, this doesn't work if there is fields types/naming conflicts
                ({
                  combinedTypes: objectType,
                  typesNames: selectionUnions,
                } = schemaValue.fieldsMap[key]);
              }

              const proxy = createAccessor(
                objectType,
                selectionArg,
                selectionUnions
              );

              return proxy && Reflect.get(proxy, key);
            } else {
              const { __type, __args } = schemaValue[key];
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
                  unions,
                });

                // For the subscribers of data changes
                interceptorManager.addSelectionCache(selection);

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

                    return isArray ? [] : null;
                  }

                  if (!innerState.allowCache) {
                    // Or if you are making the network fetch always
                    interceptorManager.addSelection(selection);
                  }

                  return cacheValue;
                }

                const typeValue: Record<string, Type> | SchemaUnion =
                  schema[pureType] || schemaUnions[pureType];
                if (typeValue) {
                  const childAccessor = (isArray
                    ? createArrayAccessor
                    : createAccessor)(typeValue, selection);

                  accessorCache.addAccessorChild(accessor, childAccessor);

                  return childAccessor;
                }

                throw new gqlessError(
                  `GraphQL Type not found: ${pureType}, available fields: "${Object.keys(
                    schemaValue
                  ).join(' | ')}"`
                );
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
            }
          },
        });
      }
    );
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
          const schemaType = schema[key];

          if (schemaType) {
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

            return createAccessor(schemaType, selection);
          }

          return Reflect.get(target, key, receiver);
        },
      }
    ) as unknown) as GeneratedSchema;
  }

  function assignSelections<A extends object, B extends A>(
    source: A | null | undefined,
    target: B | null | undefined
  ): void {
    if (source == null || target == null) return;

    let sourceSelection: Selection;
    let targetSelection: Selection;

    if (
      !accessorCache.isProxy(source) ||
      !(sourceSelection = accessorCache.getProxySelection(source)!)
    )
      throw new gqlessError('Invalid source proxy', {
        caller: assignSelections,
      });
    if (
      !accessorCache.isProxy(target) ||
      !(targetSelection = accessorCache.getProxySelection(target)!)
    )
      throw new gqlessError('Invalid target proxy', {
        caller: assignSelections,
      });

    const sourceSelections = accessorCache.getSelectionSetHistory(source);

    if (!sourceSelections) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn("Source proxy doesn't have any selections made");
      }
      return;
    }

    for (const selection of sourceSelections) {
      let mappedSelection = targetSelection;
      const filteredSelections = selection.selectionsList.filter(
        (value) => !sourceSelection.selectionsList.includes(value)
      );

      for (const { key, args, argTypes } of filteredSelections) {
        mappedSelection = selectionManager.getSelection({
          key,
          args,
          argTypes,
          prevSelection: mappedSelection,
        });
      }

      accessorCache.addSelectionToAccessorHistory(target, mappedSelection);
      interceptorManager.addSelection(mappedSelection);
    }
  }

  return {
    createAccessor,
    createArrayAccessor,
    createSchemaAccesor,
    assignSelections,
    setCache,
  };
}
