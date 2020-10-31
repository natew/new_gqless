import { get } from "lodash";

import { Selection } from "../Selection";

export function createCache() {
  const cache: Record<string, unknown> = {};

  function getCacheFromSelection(selection: Selection) {
    const path = selection.path.slice(1).join(".");
    return cache[path] ?? null;
  }

  function setCacheFromSelection(selection: Selection, data: unknown) {
    const path = selection.path.slice(1).join(".");

    cache[path] = get(data, path);
  }

  return { cache, getCacheFromSelection, setCacheFromSelection };
}
