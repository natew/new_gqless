import { get, set } from "lodash";

import { Selection } from "../Selection";

export const CacheNotFound = Symbol("Not Found");

export const ArrayField = Symbol("Array Field");

export function createCache() {
  const cache: Record<string, unknown> = {};

  function getCacheFromSelection(selection: Selection) {
    // let path = "";
    // for (const selectionValue of selection.selections) {

    // }
    const path = selection.path.slice(1).join(".");
    const value = get(cache, path, CacheNotFound);

    return value;
  }

  function setCacheFromSelection(selection: Selection, data: unknown) {
    const path = selection.path.slice(1).join(".");

    const value = get(data, path, CacheNotFound);
    if (value === CacheNotFound) {
      delete cache[path];
    } else {
      set(cache, path, value);
    }
    console.log(cache);
  }

  return { cache, getCacheFromSelection, setCacheFromSelection };
}
