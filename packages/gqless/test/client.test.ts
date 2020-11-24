import '../src/Client';

import { waitForExpect } from 'test-utils';

import { gqlessError } from '../src';
import { createTestClient } from './utils';

describe('core', () => {
  test('scheduler', async () => {
    const { query } = await createTestClient();

    expect(typeof query).toBe('object');

    expect(query.hello).toBe(null);

    waitForExpect(
      () => {
        expect(query.hello).toBe('hello world');
      },
      100,
      10
    );
  });

  test('resolved', async () => {
    const { query, resolved } = await createTestClient();

    expect(typeof query).toBe('object');

    await resolved(() => {
      return query.hello;
    }).then((value) => {
      expect(value).toBe('hello world');
    });
  });
});

describe('selectFields', () => {
  test('recursive *, depth 1', async () => {
    const { query, resolved, selectFields } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(
        query.human({
          name: 'foo',
        })
      );
    });

    expect(data).toEqual({
      name: 'foo',
      father: null,
      nullFather: null,
      sons: [null],
    });
  });

  test('recursive *, depth 2', async () => {
    const { query, resolved, selectFields } = await createTestClient();

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
      name: 'foo',
      father: {
        name: 'default',
        father: null,
        nullFather: null,
        sons: [null],
      },
      nullFather: null,
      sons: [
        {
          name: 'default',
          father: null,
          nullFather: null,
          sons: [null],
        },
        {
          name: 'default',
          father: null,
          nullFather: null,
          sons: [null],
        },
      ],
    });
  });

  test('named no recursive', async () => {
    const { query, resolved, selectFields } = await createTestClient();

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
    const { query, resolved, selectFields } = await createTestClient();

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
        name: 'default',
        father: null,
        nullFather: null,
        sons: [null],
      },
    });
  });

  test('named recursive, depth 2', async () => {
    const { query, resolved, selectFields } = await createTestClient();

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
        name: 'default',
        father: {
          name: 'default',
          father: null,
          sons: [null],
          nullFather: null,
        },
        nullFather: null,
        sons: [
          {
            name: 'default',
            father: null,
            nullFather: null,
            sons: [null],
          },
          {
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
    const { query, resolved, selectFields } = await createTestClient();

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
    const { query, resolved, selectFields } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(query.human().sons, '*');
    });

    expect(data).toEqual([
      {
        father: null,
        nullFather: null,
        sons: [null],
        name: 'default',
      },
      { father: null, nullFather: null, sons: [null], name: 'default' },
    ]);
  });

  test('empty named fields array', async () => {
    const { query, resolved, selectFields } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(query.human(), []);
    });

    expect(data).toEqual({});
  });

  test('named fields array values - depth 1', async () => {
    const { query, resolved, selectFields } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(query.human(), ['sons']);
    });

    expect(data).toEqual({
      sons: [
        { name: 'default', father: null, nullFather: null, sons: [null] },
        { name: 'default', father: null, nullFather: null, sons: [null] },
      ],
    });
  });

  test('named fields array values - depth 2', async () => {
    const { query, resolved, selectFields } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(query.human(), ['sons'], 2);
    });

    expect(data).toEqual({
      sons: [
        {
          name: 'default',
          father: {
            name: 'default',
            father: null,
            nullFather: null,
            sons: [null],
          },
          nullFather: null,
          sons: [
            { name: 'default', father: null, nullFather: null, sons: [null] },
            { name: 'default', father: null, nullFather: null, sons: [null] },
          ],
        },
        {
          name: 'default',
          father: {
            name: 'default',
            father: null,
            nullFather: null,
            sons: [null],
          },
          nullFather: null,
          sons: [
            { name: 'default', father: null, nullFather: null, sons: [null] },
            { name: 'default', father: null, nullFather: null, sons: [null] },
          ],
        },
      ],
    });
  });

  test('named fields object values - depth 1', async () => {
    const { query, resolved, selectFields } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(query.human(), ['father']);
    });

    expect(data).toEqual({
      father: { name: 'default', father: null, nullFather: null, sons: [null] },
    });
  });

  test('named fields object values - depth 2', async () => {
    const { query, resolved, selectFields } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(query.human(), ['father'], 2);
    });

    expect(data).toEqual({
      father: {
        name: 'default',
        father: {
          name: 'default',
          father: null,
          nullFather: null,
          sons: [null],
        },
        nullFather: null,
        sons: [
          { name: 'default', father: null, nullFather: null, sons: [null] },
          { name: 'default', father: null, nullFather: null, sons: [null] },
        ],
      },
    });
  });

  test('named non-existent field', async () => {
    const { query, resolved, selectFields } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(query.human(), ['non_existent_field']);
    });

    expect(data).toStrictEqual({});
  });

  test('null accessor', async () => {
    const { query, resolved, selectFields } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(query.nullArray);
    });

    expect(data).toBe(null);
  });

  test('primitive wrong accessor', async () => {
    const { resolved, selectFields } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(123 as any);
    });

    expect(data).toBe(123);
  });

  test('object wrong accessor', async () => {
    const { resolved, selectFields } = await createTestClient();

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

describe('resolved cache options', () => {
  test('refetch', async () => {
    const { query, resolved } = await createTestClient();

    const resolveFn = () => {
      const human = query.human({
        name: 'a',
      });
      return {
        name: human.name,
        nFetchCalls: query.nFetchCalls,
      };
    };

    const data = await resolved(resolveFn);

    expect(data.name).toBe('a');
    expect(data.nFetchCalls).toBe(1);

    const cachedData = await resolved(resolveFn);

    expect(cachedData.name).toBe('a');
    expect(cachedData.nFetchCalls).toBe(1);

    const refetchedData = await resolved(resolveFn, {
      refetch: true,
    });
    expect(refetchedData.name).toBe('a');
    expect(refetchedData.nFetchCalls).toBe(2);
  });

  test('noCache', async () => {
    const { query, resolved } = await createTestClient();

    const resolveFn = () => {
      const human = query.human({
        name: 'a',
      });
      return {
        name: human.name,
        nFetchCalls: query.nFetchCalls,
      };
    };

    const data = await resolved(resolveFn);

    expect(data.name).toBe('a');
    expect(data.nFetchCalls).toBe(1);

    const nonCachedData = await resolved(resolveFn, {
      noCache: true,
    });
    expect(nonCachedData.name).toBe('a');
    expect(nonCachedData.nFetchCalls).toBe(2);

    const cachedData = await resolved(resolveFn);

    expect(cachedData.name).toBe('a');
    expect(cachedData.nFetchCalls).toBe(1);
  });
});

describe('error handling', () => {
  test('resolved single throws', async () => {
    const { query, resolved } = await createTestClient();

    await resolved(() => {
      query.throw;
    })
      .then(() => {
        throw Error("Shouldn't reach here");
      })
      .catch((err) => {
        if (!(err instanceof Error)) throw Error('Incompatible error type');

        expect(err).toEqual(
          Object.assign(Error('expected error'), {
            locations: [{ line: 1, column: 7 }],
            path: ['throw'],
          })
        );
      });
  });

  test('resolved multiple throws, with shorter error for production', async () => {
    const { query, resolved } = await createTestClient();

    const prevProcessEnv = process.env.NODE_ENV;

    try {
      await resolved(() => {
        query.throw;
        query.throw2;
      })
        .then(() => {
          throw Error("Shouldn't reach here");
        })
        .catch((err) => {
          if (!(err instanceof Error)) throw Error('Incompatible error type');

          expect(err).toEqual(
            Object.assign(
              Error('GraphQL Errors, please check .graphQLErrors property'),
              {
                errors: [
                  {
                    message: 'expected error',
                    locations: [{ line: 1, column: 7 }],
                    path: ['throw'],
                  },
                  {
                    message: 'expected error 2',
                    locations: [{ line: 1, column: 13 }],
                    path: ['throw2'],
                  },
                ],
              }
            )
          );
        });

      process.env.NODE_ENV = 'production';

      await resolved(() => {
        query.throw;
        query.throw2;
      })
        .then(() => {
          throw Error("Shouldn't reach here");
        })
        .catch((err) => {
          if (!(err instanceof Error)) throw Error('Incompatible error type');

          expect(err).toEqual(
            Object.assign(Error('GraphQL Errors'), {
              errors: [
                {
                  message: 'expected error',
                  locations: [{ line: 1, column: 7 }],
                  path: ['throw'],
                },
                {
                  message: 'expected error 2',
                  locations: [{ line: 1, column: 13 }],
                  path: ['throw2'],
                },
              ],
            })
          );
        });
    } finally {
      process.env.NODE_ENV = prevProcessEnv;
    }
  });

  test('scheduler logs to console', async () => {
    const { query } = await createTestClient();

    const logErrorSpy = jest
      .spyOn(global.console, 'error')
      .mockImplementation((message) => {
        expect(message).toEqual(
          Object.assign(Error('expected error'), {
            locations: [{ line: 1, column: 7 }],
            path: ['throw'],
          })
        );
      });

    try {
      query.throw;

      await waitForExpect(
        () => {
          expect(logErrorSpy).toBeCalledTimes(1);
        },
        100,
        5
      );
    } finally {
      logErrorSpy.mockRestore();
    }
  });

  test('network error', async () => {
    const { query, resolved } = await createTestClient(undefined, () => {
      throw Error('expected network error');
    });

    try {
      await resolved(() => query.hello);

      throw Error("shouldn't reach here");
    } catch (err) {
      expect(err).toStrictEqual(
        new gqlessError('expected network error', {
          networkError: Error('expected network error'),
        })
      );
    }
  });

  test('not expect network error type', async () => {
    const { query, resolved } = await createTestClient(undefined, () => {
      throw 12345;
    });

    try {
      await resolved(() => query.hello);

      throw Error("shouldn't reach here");
    } catch (err) {
      expect(err).toBe(12345);
    }
  });
});

describe('array accessors', () => {
  test('array query', async () => {
    const { query, resolved } = await createTestClient();

    const data = await resolved(() => {
      const human = query.human();
      return human.sons.map((son) => {
        return son.name;
      });
    });

    expect(data).toEqual(['default', 'default']);

    const cachedDataHumanOutOfSize = await resolved(() => {
      const human = query.human();
      return human.sons[2];
    });

    expect(cachedDataHumanOutOfSize).toBe(undefined);
  });

  test('null cache object array', async () => {
    const { query, resolved } = await createTestClient();

    const data = await resolved(() => {
      return query.nullArray?.map((v) => v?.name) ?? null;
    });

    expect(data).toBe(null);

    expect(query.nullArray).toBe(null);
  });

  test('null cache scalar array', async () => {
    const { query, resolved } = await createTestClient();

    const data = await resolved(() => {
      return query.nullStringArray?.map((v) => v) ?? null;
    });

    expect(data).toBe(null);

    expect(query.nullStringArray).toBe(null);
  });
});

describe('accessor undefined paths', () => {
  test('undefined object path', async () => {
    const { query } = await createTestClient();

    //@ts-expect-error
    const shouldBeUndefined = query.other;

    expect(shouldBeUndefined).toBe(undefined);
  });

  test('undefined schema root path', async () => {
    const { mutation } = await createTestClient({
      //@ts-expect-error
      mutation: null,
    });

    //@ts-expect-error
    const shouldBeUndefined = mutation.other;

    expect(shouldBeUndefined).toBe(undefined);
  });

  test('intentionally manipulated schema', async () => {
    const { query } = await createTestClient({
      query: {
        other: {
          __type: 'error',
        },
      },
      wrongroot: false as any,
    });

    expect(() => {
      //@ts-expect-error
      query.other;
    }).toThrow('GraphQL Type not found!');

    expect(
      //@ts-expect-error
      query.wrongroot
    ).toBe(undefined);
  });
});

describe('mutation', () => {
  test('mutation usage', async () => {
    const { mutation, resolved } = await createTestClient();

    const data = await resolved(() => {
      return mutation.sendNotification({
        message: 'hello world',
      });
    });

    expect(data).toBe(true);
  });
});

// TODO: It's a false positive, until subscriptions are implemented
test('subscription usage', async () => {
  const { subscription, resolved } = await createTestClient();

  await resolved(() => {
    return subscription.newNotification;
  }).then((data) => {
    expect(data).toBe(null);
  });
});

describe('custom query fetcher', () => {
  test('empty data', async () => {
    const { query, resolved } = await createTestClient(
      undefined,
      (_query, _variables) => {
        return {};
      }
    );

    const data = await resolved(() => {
      return query.hello;
    });
    expect(data).toBe(null);
  });
});

describe('refetch function', () => {
  test('refetch works', async () => {
    const { query, refetch, scheduler } = await createTestClient();

    const a = query.hello;

    expect(a).toBe(null);

    expect(scheduler.resolving).toBeTruthy();

    await scheduler.resolving;

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
      expect(message).toBe('Warning: No selections made!');
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
});
