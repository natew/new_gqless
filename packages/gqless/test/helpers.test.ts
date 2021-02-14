import { selectFields } from '../src';
import { createTestClient } from './utils';

describe('selectFields', () => {
  test('recursive *, depth 1', async () => {
    const { query, resolved } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(
        query.human({
          name: 'foo',
        })
      );
    });

    expect(data).toEqual({
      __typename: 'Human',
      name: 'foo',
      father: null,
      nullFather: null,
      sons: [null],
    });
  });

  test('recursive *, depth 2', async () => {
    const { query, resolved } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(
        query.human({
          name: 'foo',
        }),
        '*',
        2
      );
    });

    expect(data).toEqual({
      __typename: 'Human',
      name: 'foo',
      father: {
        __typename: 'Human',
        name: 'default',
        father: null,
        nullFather: null,
        sons: [null],
      },
      nullFather: null,
      sons: [
        {
          __typename: 'Human',
          name: 'default',
          father: null,
          nullFather: null,
          sons: [null],
        },
        {
          __typename: 'Human',
          name: 'default',
          father: null,
          nullFather: null,
          sons: [null],
        },
      ],
    });
  });

  test('named no recursive', async () => {
    const { query, resolved } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(
        query.human({
          name: 'bar',
        }),
        ['name', 'father.name']
      );
    });

    expect(data).toEqual({
      name: 'bar',
      father: {
        name: 'default',
      },
    });
  });

  test('named recursive, depth 1', async () => {
    const { query, resolved } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(
        query.human({
          name: 'bar',
        }),
        ['father']
      );
    });

    expect(data).toEqual({
      father: {
        __typename: 'Human',
        name: 'default',
        father: null,
        nullFather: null,
        sons: [null],
      },
    });
  });

  test('named recursive, depth 2', async () => {
    const { query, resolved } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(
        query.human({
          name: 'bar',
        }),
        ['father'],
        2
      );
    });

    expect(data).toEqual({
      father: {
        __typename: 'Human',
        name: 'default',
        father: {
          __typename: 'Human',
          name: 'default',
          father: null,
          sons: [null],
          nullFather: null,
        },
        nullFather: null,
        sons: [
          {
            __typename: 'Human',
            name: 'default',
            father: null,
            nullFather: null,
            sons: [null],
          },
          {
            __typename: 'Human',
            name: 'default',
            father: null,
            nullFather: null,
            sons: [null],
          },
        ],
      },
    });
  });

  test('named recursive - array', async () => {
    const { query, resolved } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(query.human().sons, ['name']);
    });

    expect(data).toEqual([
      {
        name: 'default',
      },
      {
        name: 'default',
      },
    ]);
  });

  test('recursive * - array', async () => {
    const { query, resolved } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(query.human().sons, '*');
    });

    expect(data).toEqual([
      {
        __typename: 'Human',
        father: null,
        nullFather: null,
        sons: [null],
        name: 'default',
      },
      {
        __typename: 'Human',
        father: null,
        nullFather: null,
        sons: [null],
        name: 'default',
      },
    ]);
  });

  test('empty named fields array', async () => {
    const { query, resolved } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(query.human(), []);
    });

    expect(data).toEqual({});
  });

  test('named fields array values - depth 1', async () => {
    const { query, resolved } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(query.human(), ['sons']);
    });

    expect(data).toEqual({
      sons: [
        {
          __typename: 'Human',
          name: 'default',
          father: null,
          nullFather: null,
          sons: [null],
        },
        {
          __typename: 'Human',
          name: 'default',
          father: null,
          nullFather: null,
          sons: [null],
        },
      ],
    });
  });

  test('named fields array values - depth 2', async () => {
    const { query, resolved } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(query.human(), ['sons'], 2);
    });

    expect(data).toEqual({
      sons: [
        {
          __typename: 'Human',
          name: 'default',
          father: {
            __typename: 'Human',
            name: 'default',
            father: null,
            nullFather: null,
            sons: [null],
          },
          nullFather: null,
          sons: [
            {
              __typename: 'Human',
              name: 'default',
              father: null,
              nullFather: null,
              sons: [null],
            },
            {
              __typename: 'Human',
              name: 'default',
              father: null,
              nullFather: null,
              sons: [null],
            },
          ],
        },
        {
          __typename: 'Human',
          name: 'default',
          father: {
            __typename: 'Human',
            name: 'default',
            father: null,
            nullFather: null,
            sons: [null],
          },
          nullFather: null,
          sons: [
            {
              __typename: 'Human',
              name: 'default',
              father: null,
              nullFather: null,
              sons: [null],
            },
            {
              __typename: 'Human',
              name: 'default',
              father: null,
              nullFather: null,
              sons: [null],
            },
          ],
        },
      ],
    });
  });

  test('named fields object values - depth 1', async () => {
    const { query, resolved } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(query.human(), ['father']);
    });

    expect(data).toEqual({
      father: {
        __typename: 'Human',
        name: 'default',
        father: null,
        nullFather: null,
        sons: [null],
      },
    });
  });

  test('named fields object values - depth 2', async () => {
    const { query, resolved } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(query.human(), ['father'], 2);
    });

    expect(data).toEqual({
      father: {
        __typename: 'Human',
        name: 'default',
        father: {
          __typename: 'Human',
          name: 'default',
          father: null,
          nullFather: null,
          sons: [null],
        },
        nullFather: null,
        sons: [
          {
            __typename: 'Human',
            name: 'default',
            father: null,
            nullFather: null,
            sons: [null],
          },
          {
            __typename: 'Human',
            name: 'default',
            father: null,
            nullFather: null,
            sons: [null],
          },
        ],
      },
    });
  });

  test('named non-existent field', async () => {
    const { query, resolved } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(query.human(), ['non_existent_field']);
    });

    expect(data).toStrictEqual({});
  });

  test('null accessor', async () => {
    const { query, resolved } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(query.nullArray);
    });

    expect(data).toBe(null);
  });

  test('primitive wrong accessor', async () => {
    const { resolved } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(123 as any);
    });

    expect(data).toBe(123);
  });

  test('object wrong accessor', async () => {
    const { resolved } = await createTestClient();

    const data = await resolved(() => {
      return selectFields({
        a: 1,
      });
    });

    expect(data).toStrictEqual({
      a: 1,
    });
  });
});

describe('refetch function', () => {
  test('refetch works', async () => {
    const { query, refetch, scheduler } = await createTestClient();

    const a = query.hello;

    expect(a).toBe(null);

    expect(scheduler.resolving).toBeTruthy();

    await scheduler.resolving!.promise;

    const a2 = query.hello;

    expect(scheduler.resolving).toBe(null);

    expect(a2).toBe('hello world');

    const a3Promise = refetch(() => query.hello);

    expect(scheduler.resolving).toBeTruthy();

    const a3 = await a3Promise;

    expect(a3).toBe(a2);
  });

  test('warns about no selections inside function, except on production', async () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation((message) => {
      expect(message).toBe('gqless: No selections made!');
    });
    const prevEnv = process.env.NODE_ENV;

    try {
      const { refetch } = await createTestClient();

      const value = await refetch(() => {
        return 123;
      });

      expect(value).toBe(123);
      expect(spy).toBeCalledTimes(1);

      process.env.NODE_ENV = 'production';

      const value2 = await refetch(() => {
        return 456;
      });

      expect(value2).toBe(456);
      expect(spy).toBeCalledTimes(1);
    } finally {
      process.env.NODE_ENV = prevEnv;
      spy.mockRestore();
    }
  });

  test('refetch proxy selections', async () => {
    const { query, resolved, refetch, cache } = await createTestClient();

    const time1 = await resolved(() => query.time);

    const cacheSnapshot1 = JSON.stringify(cache);

    expect(time1).toBeTruthy();

    const time2 = query.time;

    const cacheSnapshot2 = JSON.stringify(cache);

    expect(cacheSnapshot1).toBe(cacheSnapshot2);

    expect(time2).toBe(time1);

    await refetch(query);

    const cacheSnapshot3 = JSON.stringify(cache);

    expect(cacheSnapshot3).not.toBe(cacheSnapshot2);

    const time3 = query.time;

    const cacheSnapshot4 = JSON.stringify(cache);

    expect(cacheSnapshot4).toBe(cacheSnapshot3);

    expect(time3).not.toBe(time1);

    const noSelectionsToRefetchData = await refetch(query.nullArray);

    expect(noSelectionsToRefetchData).toBeTruthy();

    const cacheSnapshot5 = JSON.stringify(cache);

    expect(cacheSnapshot5).toBe(cacheSnapshot3);

    const hello = await resolved(() => query.hello);

    const cacheSnapshot6 = JSON.stringify(cache);

    expect(cacheSnapshot6).not.toBe(cacheSnapshot5);

    expect(hello).toBe('hello world');

    const time4 = query.time;

    expect(time4).toBe(time3);

    await refetch(query);

    const time5 = query.time;

    expect(time5).not.toBe(time4);
  });

  test('refetch proxy selections with invalid proxy', async () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation((message) => {
      expect(message).toBe('gqless: Invalid proxy to refetch!');
    });

    const prevNODE_ENV = process.env.NODE_ENV;
    try {
      const { refetch } = await createTestClient();

      const invalidProxy = {};
      const refetchData = await refetch(invalidProxy);

      expect(spy).toBeCalledTimes(1);
      expect(refetchData).toBe(invalidProxy);

      process.env.NODE_ENV = 'production';

      const refetchData2 = await refetch(invalidProxy);

      expect(spy).toBeCalledTimes(1);
      expect(refetchData2).toBe(invalidProxy);
    } finally {
      process.env.NODE_ENV = prevNODE_ENV;
      spy.mockRestore();
    }
  });
});
