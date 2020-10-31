import { get } from "lodash";

import { Selection } from "../Selection";

export const CacheNotFound = Symbol("Not Found");

export function createCache() {
  const cache: Record<string, unknown> = {};

  function getCacheFromSelection(selection: Selection) {
    const path = selection.path.slice(1).join(".");
    const value = cache[path];
    if (value === undefined) {
      return CacheNotFound;
    }
    return value;
  }

  function setCacheFromSelection(selection: Selection, data: unknown) {
    const path = selection.path.slice(1).join(".");

    const value = get(data, path, CacheNotFound);
    if (value === CacheNotFound) {
      delete cache[path];
    } else {
      cache[path] = value;
    }
  }

  return { cache, getCacheFromSelection, setCacheFromSelection };
}
