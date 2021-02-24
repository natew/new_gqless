import merge from 'lodash/mergeWith';

import { CacheType } from '../Cache';
import { EventHandler } from '../Events';
import { Schema } from '../Schema';
import { Selection } from '../Selection';
import {
  isObject,
  isObjectWithType,
  ObjectWithType,
  PlainObject,
} from '../Utils';

export interface NormalizationOptions {
  identifier?: (obj: ObjectWithType) => string | null | undefined | void;
  keyFields?: Record<string, string[] | null | undefined>;
}

function toString(v: unknown): string | null {
  switch (typeof v) {
    case 'string':
      return v;
    case 'number':
    case 'bigint':
      return v + '';
    case 'boolean':
      return v ? '1' : '0';
    case 'object':
      return v && JSON.stringify(v);
    default:
      return null;
  }
}

export function createNormalizationHandler(
  options: NormalizationOptions | undefined | boolean,
  eventHandler: EventHandler,
  schema: Readonly<Schema>
) {
  if (!options) return;

  const { identifier, keyFields } = isObject(options)
    ? options
    : ({} as NormalizationOptions);

  const schemaKeys = keyFields ? Object.assign({}, keyFields) : {};

  const idSchemaKey: ['id'] = ['id'];
  const _idSchemaKey: ['_id'] = ['_id'];

  for (const [typeName, schemaType] of Object.entries(schema)) {
    if (
      !isObject(schemaType) ||
      typeName in schemaKeys ||
      typeName === 'query' ||
      typeName === 'mutation' ||
      typeName === 'subscription' ||
      !('__typename' in schemaType)
    ) {
      continue;
    }

    if (schemaType.id && !schemaType.id.__args) {
      schemaKeys[typeName] = idSchemaKey;
    } else if (schemaType._id && !schemaType._id.__args) {
      schemaKeys[typeName] = _idSchemaKey;
    }
  }

  function getId(
    obj: ObjectWithType
  ): ReturnType<NonNullable<typeof identifier>> {
    if (identifier) {
      const result = identifier(obj);

      if (result !== undefined) return result;
    }

    const keys = schemaKeys[obj.__typename];

    if (keys) {
      let id: string = '';

      for (const key of keys) {
        const value = toString(obj[key]);
        if (value !== null) id += value;
      }

      return id && obj.__typename + id;
    }
  }

  const normalizedCache: Record<string, PlainObject | undefined> = {};

  const normalizedSelections = new Map<string, Set<Selection>>();

  function getCacheFromSelection<Value, NotFound>(
    selection: Selection,
    notFoundValue: NotFound,
    cache: CacheType
  ): Value | NotFound {
    let container: PlainObject | undefined;
    let containerKey: string | number | undefined;

    let currentValue: unknown = cache;

    let currentSelection: Selection;

    function getNormalized() {
      let id: string | void | null;
      if (isObjectWithType(currentValue) && (id = getId(currentValue))) {
        let selectionsSet = normalizedSelections.get(id);
        if (!selectionsSet) {
          selectionsSet = new Set();
          normalizedSelections.set(id, selectionsSet);
        }

        selectionsSet.add(currentSelection);

        let normalizedObject: PlainObject | undefined;

        if (
          (normalizedObject = normalizedCache[id]) &&
          normalizedObject !== currentValue
        ) {
          if (container && containerKey != null) {
            container[containerKey] = normalizedObject;
          }

          currentValue = normalizedObject;
        }
      }
    }

    for (const selectionValue of selection.selectionsList) {
      currentSelection = selectionValue;
      const key = selectionValue.alias || selectionValue.key;

      if (isObject(currentValue)) {
        getNormalized();

        //@ts-expect-error
        container = currentValue;
        containerKey = key;

        currentValue =
          //@ts-expect-error
          currentValue[key];
      } else return notFoundValue;
    }

    getNormalized();

    return currentValue === undefined ? notFoundValue : (currentValue as Value);
  }

  function scanNormalizedObjects(obj: object, shouldMutate?: boolean) {
    const pendingObjects = new Set<object>([obj]);

    for (const container of pendingObjects) {
      for (const [key, value] of Object.entries(container)) {
        if (Array.isArray(value)) {
          pendingObjects.add(value);
        } else if (isObjectWithType(value)) {
          const id = getId(value);
          let data = value;
          if (id) {
            const currentValueNormalizedCache = normalizedCache[id];

            if (currentValueNormalizedCache !== value) {
              if (currentValueNormalizedCache) {
                normalizedCache[id] = data = Object.assign(
                  {},
                  currentValueNormalizedCache,
                  value
                );
              } else {
                normalizedCache[id] = value;
              }

              //@ts-expect-error
              if (shouldMutate) container[key] = value;

              if (eventHandler) {
                const selections = normalizedSelections.get(id);

                if (selections) {
                  for (const selection of selections) {
                    eventHandler.sendCacheChange({
                      data,
                      selection,
                    });
                  }
                }
              }
            } else continue;
          }

          pendingObjects.add(data);
        }
      }
    }
  }

  function onObjectMergeConflict(
    currentValue: object,
    incomingValue: object
  ): object | void {
    if (isObjectWithType(incomingValue) && isObjectWithType(currentValue)) {
      const idNewValue = getId(incomingValue);
      if (!idNewValue) return;

      const idCurrentValue = getId(currentValue);

      if (idNewValue === idCurrentValue) {
        const currentObject = normalizedCache[idNewValue];

        if (currentObject !== incomingValue) {
          return (normalizedCache[idNewValue] = merge(
            {},
            currentObject,
            incomingValue,
            onObjectMergeConflict
          ));
        }
        return incomingValue;
      }
    }
  }

  return {
    getId,
    getCacheFromSelection,
    scanNormalizedObjects,
    normalizedCache,
    onObjectMergeConflict,
    schemaKeys,
  };
}

export type NormalizationHandler = ReturnType<
  typeof createNormalizationHandler
>;
