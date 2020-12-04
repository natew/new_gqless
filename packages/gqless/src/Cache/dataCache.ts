import lodashGet from 'lodash/get';
import lodashSet from 'lodash/set';
import lodashMerge from 'lodash/merge';

import { Selection } from '../Selection';

export const CacheNotFound = Symbol('Not Found');

export type CacheType = Record<string, unknown>;

export function createCache() {
  const cache: CacheType = {};

  function getCacheFromSelection(selection: Selection) {
    return lodashGet(cache, selection.cachePath, CacheNotFound);
  }

  function setCacheFromSelection(selection: Selection, value: unknown) {
    lodashSet(cache, selection.cachePath, value);
  }

  function mergeCache(
    data: unknown,
    prefix: 'query' | 'mutation' | 'subscription'
  ) {
    lodashMerge(cache, { [prefix]: data });
  }

  return { cache, getCacheFromSelection, setCacheFromSelection, mergeCache };
}

export type CacheInstance = ReturnType<typeof createCache>;
