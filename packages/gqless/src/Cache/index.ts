import lodashGet from 'lodash/get';
import lodashMerge from 'lodash/merge';

import { Selection } from '../Selection';

export const CacheNotFound = Symbol('Not Found');

export function createCache() {
  const cache: Record<string, unknown> = {};

  function getCacheFromSelection(selection: Selection) {
    const path = selection.path.slice(1);
    return lodashGet(cache, path, CacheNotFound);
  }

  function mergeCache(data: unknown) {
    lodashMerge(cache, data);
  }

  return { cache, getCacheFromSelection, mergeCache };
}
