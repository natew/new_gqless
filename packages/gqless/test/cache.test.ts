import { assertIsDefined } from 'test-utils';

import { CacheNotFound, createAccessorCache, createCache } from '../src/Cache';
import { Selection } from '../src/Selection';

describe('accessorCache', () => {
  test('getAccessor', () => {
    const cache = createAccessorCache();

    const selection = new Selection({
      key: 'a',
    });

    const obj = cache.getAccessor(selection, () => {
      return {
        a: 1,
      };
    });

    expect(obj).toEqual({
      a: 1,
    });

    const obj2 = cache.getAccessor(selection, () => {
      throw Error("This shouldn't be called");
    });

    expect(obj).toBe(obj2);

    const selectionFromCache = cache.getProxySelection(obj);

    expect(selectionFromCache).toBe(selection);

    assertIsDefined(selection);

    expect(selection.key).toBe('a');
    expect(selection.cachePath).toEqual(['a']);
    expect(selection.pathString).toBe('a');

    const isProxyFromCache = cache.isProxy(obj);

    expect(isProxyFromCache).toBe(true);

    expect(cache.isProxy({})).toBe(false);
  });

  test('getArrayAccessor', () => {
    const cache = createAccessorCache();

    const selection = new Selection({
      key: 'a',
    });

    const arrayValue = [123];

    const obj = cache.getArrayAccessor(selection, arrayValue, () => {
      return {
        a: 1,
      };
    });

    expect(obj).toEqual({
      a: 1,
    });

    const obj2 = cache.getArrayAccessor(selection, arrayValue, () => {
      throw Error("This shouldn't be called");
    });

    expect(obj).toBe(obj2);

    const selectionFromCache = cache.getProxySelection(obj);

    expect(selectionFromCache).toBe(selection);

    assertIsDefined(selection);

    expect(selection.key).toBe('a');
    expect(selection.cachePath).toEqual(['a']);
    expect(selection.pathString).toBe('a');

    const isProxyFromCache = cache.isProxy(obj);

    expect(isProxyFromCache).toBe(true);

    expect(cache.isProxy({})).toBe(false);
  });
});

describe('dataCache', () => {
  test('works', () => {
    const cache = createCache();

    const selectionBase = new Selection({
      key: 'query',
    });

    const selection = new Selection({
      key: 'a',
      prevSelection: selectionBase,
    });

    const dataEmpty = cache.getCacheFromSelection(selection);

    expect(dataEmpty).toBe(CacheNotFound);

    cache.mergeCache(
      {
        a: 1,
      },
      'query'
    );

    const data = cache.getCacheFromSelection(selection);

    expect(data).toBe(1);
  });
});
