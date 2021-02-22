import merge from 'lodash/mergeWith';

import { EventHandler } from '../Events';
import { Selection } from '../Selection';
import { isObject, isObjectWithType, PlainObject, set } from '../Utils';

export const CacheNotFound = Symbol('Not Found');

export type CacheType = Record<string, unknown>;

export function getId<
  T extends { __typename?: unknown; id?: unknown; _id?: unknown }
>(obj: T): string | void {
  const __typename: unknown = obj.__typename;
  const id: unknown = obj.id || obj._id;

  if (
    (typeof id === 'string' || typeof id === 'number') &&
    typeof __typename === 'string'
  ) {
    return __typename + id;
  }
}

export function createCache(eventHandler?: EventHandler) {
  const cache: CacheType = {};
  const normalizedCache: Record<string, PlainObject | undefined> = {};

  const normalizedSelections = new Map<string, Set<Selection>>();

  function getCacheFromSelection(
    selection: Selection,
    notFoundValue: unknown = CacheNotFound
  ): any {
    let container: PlainObject | undefined;
    let containerKey: string | number | undefined;

    let currentValue: unknown = cache;

    let currentSelection: Selection;

    function getNormalized() {
      let id: string | void;
      if (isObject(currentValue) && (id = getId(currentValue))) {
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
      } else {
        return notFoundValue;
      }
    }

    getNormalized();

    return currentValue === undefined ? notFoundValue : currentValue;
  }

  function setCacheFromSelection(selection: Selection, value: unknown) {
    if (isObject(value)) scanNormalizedObjects(value);

    set(cache, selection.cachePath, value);
  }

  function onObjectMergeConflict(
    currentValue: object,
    incomingValue: object
  ): object | void {
    if (isObjectWithType(incomingValue) && isObjectWithType(currentValue)) {
      const idNewValue = getId(incomingValue);
      const idCurrentValue = getId(currentValue);

      if (idNewValue) {
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
        }
        return (normalizedCache[idNewValue] = incomingValue);
      }
    }

    if (
      Array.isArray(currentValue) &&
      Array.isArray(incomingValue) &&
      currentValue.length !== incomingValue.length
    ) {
      return incomingValue;
    }
  }

  function scanNormalizedObjects(obj: object) {
    const pendingObjects = new Set<object>([obj]);

    for (const container of pendingObjects) {
      for (const [key, value] of Object.entries(container)) {
        if (isObjectWithType(value)) {
          const id = getId(value);
          let data = value;
          if (id) {
            const currentValueNormalizedCache = normalizedCache[id];

            if (currentValueNormalizedCache !== value) {
              if (currentValueNormalizedCache) {
                //@ts-expect-error
                container[key] = normalizedCache[id] = data = merge(
                  {},
                  currentValueNormalizedCache,
                  value,
                  onObjectMergeConflict
                );
              } else {
                //@ts-expect-error
                container[key] = normalizedCache[id] = value;
              }

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
            }
          }

          pendingObjects.add(data);
        }
      }
    }
  }

  function mergeCache(
    data: Record<string, unknown>,
    prefix: 'query' | 'mutation' | 'subscription'
  ) {
    scanNormalizedObjects(data);

    merge(cache, { [prefix]: data }, onObjectMergeConflict);
  }

  return {
    cache,
    getCacheFromSelection,
    setCacheFromSelection,
    mergeCache,
    normalizedCache,
  };
}

export type CacheInstance = ReturnType<typeof createCache>;
