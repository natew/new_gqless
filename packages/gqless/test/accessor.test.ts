import { createTestClient } from './utils';

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

describe('setCache', () => {
  test('expected functionality', async () => {
    const { scheduler, query, mutation, setCache } = await createTestClient();

    const humanQuery = query.human({
      name: 'aaa',
    });

    const name1 = humanQuery.name;

    expect(name1).toBe(null);

    expect(scheduler.resolving).toBeTruthy();
    await scheduler.resolving!.promise;

    const name2 = humanQuery.name;

    expect(name2).toBe('aaa');

    const humanMutation = mutation.humanMutation({
      nameArg: 'zzz',
    });

    const name3 = humanMutation.name;

    expect(name3).toBe(null);

    expect(scheduler.resolving).toBeTruthy();
    await scheduler.resolving!.promise;

    const name4 = humanMutation.name;

    expect(name4).toBe('zzz');

    expect(scheduler.resolving).toBe(null);

    setCache(humanQuery, humanMutation);

    expect(humanQuery.name).toBe(name4);

    humanQuery.name = 'bbb';

    expect(humanQuery.name).toBe('bbb');

    setCache(
      humanQuery,
      query.human({
        name: 'nnn',
      })
    );

    const name5 = humanQuery.name;

    expect(name5).toBe(null);

    expect(scheduler.resolving).toBeTruthy();
    await scheduler.resolving!.promise;

    const name6 = humanQuery.name;

    expect(name6).toBe('aaa');

    humanQuery.sons[0] = humanQuery;

    expect(humanQuery.sons[0].name).toBe('aaa');

    setCache(
      query.human,
      {
        name: 'hhh',
      },
      {
        name: 'nnn',
      }
    );

    expect(
      query.human({
        name: 'hhh',
      }).name
    ).toBe('nnn');
  });

  test('validation', async () => {
    const { setCache, query } = await createTestClient();

    expect(() => {
      setCache((_args?: { a: string }) => {}, undefined, undefined);
    }).toThrowError('Invalid gqless function');

    expect(() => {
      setCache(
        (_args?: { a: string }) => {},
        () => {}
      );
    }).toThrowError('Invalid arguments of type: ' + 'function');

    expect(() => {
      setCache(
        (_args?: { a: string }) => {},
        //@ts-expect-error
        123123
      );
    }).toThrowError('Invalid arguments of type: ' + 'number');

    expect(() => {
      setCache({}, {});
    }).toThrowError('Invalid gqless proxy');

    expect(() => {
      //@ts-expect-error
      query.human({ name: 'ñññ' }).sons['hello'] = null;
    }).toThrowError('Invalid array assignation');

    expect(() => {
      //@ts-expect-error
      query.human({ name: 'ñññ' }).zxc = null;
    }).toThrowError('Invalid proxy assignation');
  });
});
