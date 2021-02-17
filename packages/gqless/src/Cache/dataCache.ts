import lodashGet from 'lodash/get';
import lodashSet from 'lodash/set';
import lodashMerge from 'lodash/mergeWith';

import { Selection } from '../Selection';

export const CacheNotFound = Symbol('Not Found');

export type CacheType = Record<string, unknown>;

function mergeCustomizer(
  currentValue: unknown,
  incomingValue: unknown
): unknown[] | void {
  if (
    Array.isArray(currentValue) &&
    Array.isArray(incomingValue) &&
    currentValue.length !== incomingValue.length
  ) {
    return incomingValue;
  }
}

export function createCache() {
  const cache: CacheType = {};

  function getCacheFromSelection(
    selection: Selection,
    notFoundValue: unknown = CacheNotFound
  ) {
    return lodashGet(cache, selection.cachePath, notFoundValue);
  }

  function setCacheFromSelection(selection: Selection, value: unknown) {
    lodashSet(cache, selection.cachePath, value);
  }

  function mergeCache(
    data: unknown,
    prefix: 'query' | 'mutation' | 'subscription'
  ) {
    lodashMerge(cache, { [prefix]: data }, mergeCustomizer);
  }

  return { cache, getCacheFromSelection, setCacheFromSelection, mergeCache };
}

export type CacheInstance = ReturnType<typeof createCache>;
