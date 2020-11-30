import lodashGet from 'lodash/get';
import lodashMerge from 'lodash/merge';

import { Selection } from '../Selection';

export const CacheNotFound = Symbol('Not Found');

export type CacheType = Record<string, unknown>;

export function createCache() {
  const cache: CacheType = {};

  function getCacheFromSelection(selection: Selection) {
    return lodashGet(cache, selection.cachePath, CacheNotFound);
  }

  function mergeCache(
    data: unknown,
    prefix: 'query' | 'mutation' | 'subscription'
  ) {
    lodashMerge(cache, { [prefix]: data });
  }

  return { cache, getCacheFromSelection, mergeCache };
}

export type CacheInstance = ReturnType<typeof createCache>;
