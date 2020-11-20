import lodashGet from 'lodash/get';
import lodashMerge from 'lodash/merge';

import { Selection } from '../Selection';

export const CacheNotFound = Symbol('Not Found');

export function createCache() {
  const cache: Record<string, unknown> = {};

  function getCacheFromSelection(selection: Selection) {
    return lodashGet(cache, selection.cachePath, CacheNotFound);
  }

  function mergeCache(data: unknown) {
    lodashMerge(cache, data);
  }

  return { cache, getCacheFromSelection, mergeCache };
}
