import lodashSet from 'lodash/set';
import lodashMerge from 'lodash/mergeWith';

import { Selection } from '../Selection';
import { AccessibleObject, isObject } from '../Utils';
import { EventHandler } from '../Events';

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

export function createCache(_eventHandler?: EventHandler) {
  const cache: CacheType = {};
  const normalizedCache: Record<string, AccessibleObject | undefined> = {};

  function getCacheFromSelection(
    selection: Pick<Selection, 'cachePath'>,
    notFoundValue: unknown = CacheNotFound
  ): any {
    let container: AccessibleObject | undefined;
    let containerKey: string | number | undefined;

    let currentValue: unknown = cache;

    function getNormalized() {
      let id: string | void;
      let normalizedObject: AccessibleObject | undefined;
      if (
        isObject(currentValue) &&
        (id = getId(currentValue)) &&
        (normalizedObject = normalizedCache[id]) &&
        normalizedObject !== currentValue
      ) {
        if (container && containerKey != null) {
          container[containerKey] = normalizedObject;
        }

        currentValue = normalizedObject;
      }
    }

    for (const key of selection.cachePath) {
      if (isObject(currentValue)) {
        getNormalized();

        container = currentValue;
        containerKey = key;

        currentValue = currentValue[key];
      } else {
        return notFoundValue;
      }
    }

    getNormalized();

    return currentValue === undefined ? notFoundValue : currentValue;
  }

  function setCacheFromSelection(selection: Selection, value: unknown) {
    if (isObject(value)) scanNormalizedObjects(value);

    lodashSet(cache, selection.cachePath, value);
  }

  function mergeCustomizer(
    currentValue: unknown,
    incomingValue: unknown
  ): object | void {
    if (isObject(incomingValue) && isObject(currentValue)) {
      const idNewValue = getId(incomingValue);
      const idCurrentValue = getId(currentValue);

      if (idNewValue) {
        if (idNewValue === idCurrentValue) {
          const currentObject = normalizedCache[idNewValue];

          if (currentObject !== incomingValue) {
            return (normalizedCache[idNewValue] = lodashMerge(
              {},
              currentObject,
              incomingValue,
              mergeCustomizer
            ));
          }
        }
        return (normalizedCache[idNewValue] = incomingValue);
      } else {
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

  function scanNormalizedObjects(data: Record<string, unknown>) {
    const pendingObjects = new Set<AccessibleObject>([data]);

    for (const container of pendingObjects) {
      for (const [key, value] of Object.entries(container)) {
        if (isObject(value)) {
          const id = getId(value);

          if (id) {
            const currentValueNormalizedCache = normalizedCache[id];

            if (currentValueNormalizedCache) {
              container[key] = normalizedCache[id] = lodashMerge(
                {},
                currentValueNormalizedCache,
                value,
                mergeCustomizer
              );
            } else {
              container[key] = normalizedCache[id] = value;
            }
          }

          pendingObjects.add(value);
        }
      }
    }
  }

  function mergeCache(
    data: Record<string, unknown>,
    prefix: 'query' | 'mutation' | 'subscription'
  ) {
    scanNormalizedObjects(data);
    // TODO: Change lodash merge to use hand-made merge
    lodashMerge(cache, { [prefix]: data }, mergeCustomizer);
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
