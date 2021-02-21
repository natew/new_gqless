import { EventHandler } from '../Events';
import { Selection } from '../Selection';
import { PlainObject, isObject, isObjectWithType, merge, set } from '../Utils';

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
  const normalizedCache: Record<string, PlainObject | undefined> = {};

  function getCacheFromSelection(
    selection: Pick<Selection, 'cachePath'>,
    notFoundValue: unknown = CacheNotFound
  ): any {
    let container: PlainObject | undefined;
    let containerKey: string | number | undefined;

    let currentValue: unknown = cache;

    function getNormalized() {
      let id: string | void;
      let normalizedObject: PlainObject | undefined;
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

  function mergeCustomizer(
    currentValue: object,
    incomingValue: object
  ): object | void {
    if (isObjectWithType(incomingValue)) {
      const idNewValue = getId(incomingValue);
      const idCurrentValue = getId(currentValue);

      if (idNewValue) {
        if (idNewValue === idCurrentValue) {
          const currentObject = normalizedCache[idNewValue];

          if (currentObject !== incomingValue) {
            return (normalizedCache[idNewValue] = merge(
              {},
              [currentObject, incomingValue],
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

  function scanNormalizedObjects(data: object) {
    const pendingObjects = new Set<object>([data]);

    for (const container of pendingObjects) {
      for (const [key, value] of Object.entries(container)) {
        if (isObjectWithType(value)) {
          const id = getId(value);

          if (id) {
            const currentValueNormalizedCache = normalizedCache[id];

            if (currentValueNormalizedCache) {
              //@ts-expect-error
              container[key] = normalizedCache[id] = merge(
                {},
                [currentValueNormalizedCache, value],
                mergeCustomizer
              );
            } else {
              //@ts-expect-error
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
    merge(cache, [{ [prefix]: data }], mergeCustomizer);
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
