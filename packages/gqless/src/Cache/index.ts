import { get, merge } from "lodash";

import { Selection } from "../Selection";

export const CacheNotFound = Symbol("Not Found");

export const ArrayField = Symbol("Array Field");

export function createCache() {
  const cache: Record<string, unknown> = {};

  function getCacheFromSelection(selection: Selection) {
    const path = selection.path.slice(1);
    return get(cache, path, CacheNotFound);
  }

  function mergeCache(data: unknown) {
    merge(cache, data);
  }

  return { cache, getCacheFromSelection, mergeCache };
}
