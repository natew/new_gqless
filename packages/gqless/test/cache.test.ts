import { assertIsDefined } from 'test-utils';

import { CacheNotFound, createAccessorCache, createCache } from '../src/Cache';
import { Selection } from '../src/Selection';
import { createSelectionManager } from '../src/Selection/SelectionManager';
import { createTestClient } from './utils';

describe('accessorCache', () => {
  test('getAccessor', () => {
    const cache = createAccessorCache();

    const selection = new Selection({
      key: 'a',
    });

    const obj = cache.getAccessor(selection, null, () => {
      return {
        a: 1,
      };
    });

    expect(obj).toEqual({
      a: 1,
    });

    const obj2 = cache.getAccessor(selection, null, () => {
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

  test('getting selections history', () => {
    const {
      addSelectionToAccessorHistory,
      getAccessor,
      getSelectionSetHistory,
      addAccessorChild,
    } = createAccessorCache();

    const rootAccessor = getAccessor(
      new Selection({
        key: 'root',
      }),
      null,
      () => {
        return {
          root: true,
        };
      }
    );

    const selectionA = new Selection({
      key: 'a',
    });

    const accessorA = getAccessor(selectionA, null, () => {
      return {
        a: 1,
      };
    });

    addAccessorChild(rootAccessor, accessorA);

    const selectionB = new Selection({
      key: 'b',
    });

    const accessorB = getAccessor(selectionB, null, () => {
      return {
        b: 2,
      };
    });

    addAccessorChild(accessorA, accessorB);

    addSelectionToAccessorHistory(accessorA, selectionA);

    const selections1 = getSelectionSetHistory(accessorA)!;

    expect(selections1).toBeTruthy();

    expect(selections1).toStrictEqual(new Set([selectionA]));

    addSelectionToAccessorHistory(accessorB, selectionB);

    const selections2 = getSelectionSetHistory(accessorB)!;

    expect(selections2).toBeTruthy();

    expect(selections2).toStrictEqual(new Set([selectionB]));

    const selections3 = getSelectionSetHistory(accessorA)!;

    expect(selections3).toBeTruthy();

    expect(selections3).toStrictEqual(new Set([selectionA, selectionB]));

    const selections4 = getSelectionSetHistory(rootAccessor)!;

    expect(selections4).toBeTruthy();

    expect(selections4).toStrictEqual(new Set([selectionA, selectionB]));
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
      'query',
      [selection]
    );

    const data = cache.getCacheFromSelection(selection);

    expect(data).toBe(1);
  });

  test('toJSON', async () => {
    const { query, scheduler } = await createTestClient();

    expect(JSON.stringify(query)).toBe('{}');

    expect(JSON.stringify(query.nullArray)).toBe('[]');

    await scheduler.resolving?.promise;
  });

  test.only('merge works as it should with arrays', async () => {
    const { getSelection } = createSelectionManager();
    const { cache, mergeCache } = createCache();

    function expectCacheToBe(v: typeof cache) {
      try {
        expect(JSON.stringify(cache)).toBe(JSON.stringify(v));
      } catch (err) {
        Error.captureStackTrace(err, expectCacheToBe);
        throw err;
      }
    }

    const querySelection = getSelection({
      key: 'query',
    });

    const otherSelection = getSelection({
      key: 'other',
      prevSelection: querySelection,
    });

    const array1Selection = getSelection({
      key: 'array1',
      prevSelection: querySelection,
    });

    const array2Selection = getSelection({
      key: 'array2',
      prevSelection: querySelection,
    });

    const array2SelectionIndex = getSelection({
      key: 0,
      prevSelection: array2Selection,
    });

    const aArray2Selection = getSelection({
      key: 'a',
      prevSelection: array2SelectionIndex,
    });

    mergeCache(
      {
        other: 123,
        array1: [1, 2],
        array2: [
          {
            a: 1,
          },
        ],
      },
      'query',
      [otherSelection, array1Selection, aArray2Selection]
    );

    expectCacheToBe({
      query: {
        other: 123,
        array1: [1, 2],
        array2: [
          {
            a: 1,
          },
        ],
      },
    });

    mergeCache(
      {
        array1: [3],
      },
      'query',
      [array1Selection]
    );

    expectCacheToBe({
      query: {
        other: 123,
        array1: [3],
        array2: [
          {
            a: 1,
          },
        ],
      },
    });

    const bArray2Selection = getSelection({
      key: 'b',
      prevSelection: array2SelectionIndex,
    });

    mergeCache(
      {
        array2: [
          {
            b: 2,
          },
        ],
      },
      'query',
      [bArray2Selection]
    );

    expectCacheToBe({
      query: {
        other: 123,
        array1: [3],
        array2: [
          {
            a: 1,
            b: 2,
          },
        ],
      },
    });

    mergeCache(
      {
        array2: [],
      },
      'query',
      [bArray2Selection]
    );

    expectCacheToBe({
      query: {
        other: 123,
        array1: [3],
        array2: [],
      },
    });

    mergeCache(
      {
        array2: [
          {
            c: 1,
          },
          {
            d: 1,
          },
          {
            e: 1,
          },
        ],
      },
      'query',
      []
    );

    expectCacheToBe({
      query: {
        other: 123,
        array1: [3],
        array2: [
          {
            c: 1,
          },
          {
            d: 1,
          },
          {
            e: 1,
          },
        ],
      },
    });

    mergeCache(
      {
        array1: null,
      },
      'query',
      []
    );

    expectCacheToBe({
      query: {
        other: 123,
        array1: null,
        array2: [
          {
            c: 1,
          },
          {
            d: 1,
          },
          {
            e: 1,
          },
        ],
      },
    });
  });
});
