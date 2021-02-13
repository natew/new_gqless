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
import { isInteger } from '../Utils';

export function AccessorCreators<
  GeneratedSchema extends {
    query: {};
    mutation: {};
    subscription: {};
  } = never
>(innerState: InnerClientState) {
  const ProxySymbol = Symbol('gqless-proxy');

  const {
    accessorCache,
    selectionManager,
    interceptorManager,
    scalarsEnumsHash,
    schema,
    eventHandler,
  } = innerState;

  const unionObjectTypesForSelections: Record<string, [string]> = {};

  type SchemaUnion = {
    /** union name */
    name: string;
    types: Record<
      /** object type name */
      string,
      /** schema type of object type */
      Record<string, Type>
    >;
    /**
     * Proxy target, pre-made for performance
     */
    fieldsProxy: Record<string, typeof ProxySymbol>;
    fieldsMap: Record<
      /** field name */
      string,
      /** list of object types (with it's schema type)
       * that has the field name */
      {
        list: { objectTypeName: string; type: Record<string, Type> }[];
        typesNames: string[];
      }
    >;
  };

  const schemaUnions = Object.entries(schema[SchemaUnionsKey] || {}).reduce(
    (acum, [name, unionTypes]) => {
      const fieldsSet = new Set<string>();
      const fieldsMap: SchemaUnion['fieldsMap'] = {};

      const types = unionTypes.reduce((typeAcum, objectTypeName) => {
        unionObjectTypesForSelections[objectTypeName] ||= [objectTypeName];
        const objectType = schema[objectTypeName];
        if (objectType) {
          for (const objectTypeFieldName of Object.keys(objectType)) {
            fieldsMap[objectTypeFieldName] ||= { list: [], typesNames: [] };
            fieldsMap[objectTypeFieldName].list.push({
              type: objectType,
              objectTypeName,
            });
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

      acum[name] = {
        name,
        types,
        fieldsProxy: Array.from(fieldsSet).reduce((fieldsAcum, fieldName) => {
          fieldsAcum[fieldName] = ProxySymbol;
          return fieldsAcum;
        }, {} as SchemaUnion['fieldsProxy']),
        fieldsMap,
      };
      return acum;
    },
    {} as Record<string, SchemaUnion>
  );

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
    } else return value;
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
        throw new gqlessError(
          'Invalid arguments of type: ' + typeof dataOrArgs,
          {
            caller: setCache,
          }
        );
      }

      const resolveInfo = (accessor as Function & {
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
    } else if (accessorCache.isProxy(accessor)) {
      const selection = accessorCache.getProxySelection(accessor);

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

  function isValidCacheObject(v: any): v is { __typename: string } {
    return (
      typeof v === 'object' && v !== null && typeof v.__typename === 'string'
    );
  }

  function createUnionAccessor(
    { fieldsProxy, types: unionTypes, fieldsMap }: SchemaUnion,
    selectionArg: Selection
  ) {
    const cacheValue: unknown = innerState.clientCache.getCacheFromSelection(
      selectionArg
    );
    if (innerState.allowCache && cacheValue === null) return null;

    const typenameSelection = selectionManager.getSelection({
      key: '__typename',
      prevSelection: selectionArg,
    });

    function getUnionTypename() {
      const cacheValue: unknown = innerState.clientCache.getCacheFromSelection(
        selectionArg
      );
      if (isValidCacheObject(cacheValue)) {
        return cacheValue.__typename;
      }

      interceptorManager.addSelection(typenameSelection);
      return null;
    }

    const accessor = accessorCache.getAccessor(selectionArg, cacheValue, () => {
      return new Proxy(fieldsProxy, {
        set() {
          // TODO
          return true;
        },
        get(target, key: string, receiver) {
          if (key === 'toJSON')
            return () =>
              innerState.clientCache.getCacheFromSelection(selectionArg, {});

          if (!fieldsProxy.hasOwnProperty(key))
            return Reflect.get(target, key, receiver);

          let unionTypeName = getUnionTypename();

          let objectType: Record<string, Type>;

          let selectionUnions: string[];

          if (unionTypeName) {
            objectType = unionTypes[unionTypeName];
            selectionUnions = unionObjectTypesForSelections[unionTypeName] || [
              unionTypeName,
            ];
          } else {
            const { list: typesList, typesNames } = fieldsMap[key];

            selectionUnions = typesNames;

            if (!typesList) return;

            // TODO: Long term fix, this doesn't work if there is fields types/naming conflicts
            objectType = typesList[0].type;
          }

          const proxy: Record<string, unknown> | null = createAccessor(
            objectType,
            selectionArg,
            selectionUnions
          ) as any;

          if (!proxy) return;

          return proxy[key];
        },
      });
    });

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

  function createAccessor(
    schemaType: Schema[string],
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
        return new Proxy(
          Object.keys(schemaType).reduce((acum, key) => {
            acum[key] = ProxySymbol;
            return acum;
          }, {} as Record<string, unknown>),
          {
            set(_target, key: string, value: unknown) {
              if (!schemaType.hasOwnProperty(key))
                throw TypeError('Invalid proxy assignation');

              const targetSelection = selectionManager.getSelection({
                key,
                prevSelection: selectionArg,
                unions,
              });

              const data = extractDataFromProxy(value);

              innerState.clientCache.setCacheFromSelection(
                targetSelection,
                data
              );
              eventHandler.sendCacheChange({
                data,
                selection: targetSelection,
              });

              return true;
            },
            get(target, key: string, receiver) {
              if (key === 'toJSON')
                return () =>
                  innerState.clientCache.getCacheFromSelection(
                    selectionArg,
                    {}
                  );

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

                let schemaUnion: SchemaUnion | undefined;
                const typeValue = schema[pureType];
                if (typeValue) {
                  const childAccessor = isArray
                    ? createArrayAccessor(typeValue, selection)
                    : createAccessor(typeValue, selection);

                  accessorCache.addAccessorChild(accessor, childAccessor);

                  return childAccessor;
                } else if ((schemaUnion = schemaUnions[pureType])) {
                  const childAccessor = createUnionAccessor(
                    schemaUnion,
                    selection
                  );

                  accessorCache.addAccessorChild(accessor, childAccessor);

                  return childAccessor;
                }

                throw new gqlessError(
                  `GraphQL Type not found: ${pureType}, available fields: "${Object.keys(
                    schemaType
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
            },
          }
        );
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
