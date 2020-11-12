import { merge } from 'lodash';
import { createTestApp, gql, waitForExpect } from 'test-utils';

import { generate } from '@dish/gqless-cli';

import { createClient, DeepPartial, Schema } from '../src';

type Maybe<T> = T | null;
type Human = {
  name: string;
  father: Human;
  nullFather?: Maybe<Human>;
  sons: Human[];
};

const createTestClient = async (
  addedToGeneratedSchema?: DeepPartial<Schema>
) => {
  const createHuman = (name?: string) => {
    return {
      name: name || 'default',
    };
  };
  let nFetchCalls = 0;
  const { server, client: mercuriusTestClient, isReady } = createTestApp({
    schema: gql`
      type Query {
        hello: String!
        human(name: String): Human
        nFetchCalls: Int!
        throw: Boolean
        throw2: Boolean
      }
      type Mutation {
        sendNotification(message: String!): Boolean!
      }
      type Subscription {
        newNotification: String
      }
      type Human {
        name: String!
        father: Human!
        nullFather: Human
        sons: [Human!]!
      }
    `,
    resolvers: {
      Query: {
        hello() {
          return 'hello world';
        },
        human(_root, { name }: { name?: string }) {
          return createHuman(name);
        },
        nFetchCalls() {
          return nFetchCalls;
        },
        async throw() {
          throw Error('expected error');
        },
        async throw2() {
          throw Error('expected error 2');
        },
      },
      Mutation: {
        sendNotification(_root, { message }: { message: string }, ctx) {
          ctx.pubsub.publish({
            topic: 'NOTIFICATION',
            payload: message,
          });

          return true;
        },
      },
      Subscription: {
        newNotification: {
          subscribe(_root, _args, ctx) {
            return ctx.pubsub.subscribe('NOTIFICATION');
          },
        },
      },
      Human: {
        father() {
          return createHuman();
        },
        sons() {
          return [createHuman(), createHuman()];
        },
      },
    },
    context() {
      nFetchCalls++;
      return {};
    },
    subscription: true,
  });

  await isReady;

  const { generatedSchema, scalarsEnumsHash } = await generate(
    server.graphql.schema
  );

  return createClient<{
    query: {
      hello: string;
      human: (args?: { name?: string }) => Human;
      nFetchCalls: number;
      throw?: boolean;
      throw2?: boolean;
    };
    mutation: {
      sendNotification(args: { message: string }): boolean;
    };
    subscription: {
      newNotification: void;
    };
  }>(
    merge(generatedSchema, addedToGeneratedSchema),
    scalarsEnumsHash,
    (query, variables) => {
      return mercuriusTestClient.query(query, {
        variables,
      });
    }
  );
};

describe('core', () => {
  test('scheduler', async () => {
    const { client } = await createTestClient();

    expect(typeof client).toBe('object');

    expect(client.query.hello).toBe(null);

    waitForExpect(
      () => {
        expect(client.query.hello).toBe('hello world');
      },
      100,
      10
    );
  });

  test('resolved', async () => {
    const { client, resolved } = await createTestClient();

    expect(typeof client).toBe('object');

    await resolved(() => {
      return client.query.hello;
    }).then((value) => {
      expect(value).toBe('hello world');
    });
  });
});

describe('selectFields', () => {
  test('recursive *, depth 1', async () => {
    const { client, resolved, selectFields } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(
        client.query.human({
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
    const { client, resolved, selectFields } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(
        client.query.human({
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
    const { client, resolved, selectFields } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(
        client.query.human({
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
    const { client, resolved, selectFields } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(
        client.query.human({
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
    const { client, resolved, selectFields } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(
        client.query.human({
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
    const { client, resolved, selectFields } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(client.query.human().sons, ['name']);
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
    const { client, resolved, selectFields } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(client.query.human().sons, '*');
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
    const { client, resolved, selectFields } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(client.query.human(), []);
    });

    expect(data).toEqual({});
  });

  test('named fields array values - depth 1', async () => {
    const { client, resolved, selectFields } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(client.query.human(), ['sons']);
    });

    expect(data).toEqual({
      sons: [
        { name: 'default', father: null, nullFather: null, sons: [null] },
        { name: 'default', father: null, nullFather: null, sons: [null] },
      ],
    });
  });

  test('named fields array values - depth 2', async () => {
    const { client, resolved, selectFields } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(client.query.human(), ['sons'], 2);
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
});

describe('resolved cache options', () => {
  test('refetch', async () => {
    const { client, resolved } = await createTestClient();

    const resolveFn = () => {
      const human = client.query.human({
        name: 'a',
      });
      return {
        name: human.name,
        nFetchCalls: client.query.nFetchCalls,
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
    const { client, resolved } = await createTestClient();

    const resolveFn = () => {
      const human = client.query.human({
        name: 'a',
      });
      return {
        name: human.name,
        nFetchCalls: client.query.nFetchCalls,
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
    const { client, resolved } = await createTestClient();

    await resolved(() => {
      client.query.throw;
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

  test('resolved multiple throws', async () => {
    const { client, resolved } = await createTestClient();

    await resolved(() => {
      client.query.throw;
      client.query.throw2;
    })
      .then(() => {
        throw Error("Shouldn't reach here");
      })
      .catch((err) => {
        if (!(err instanceof Error)) throw Error('Incompatible error type');

        expect(err).toEqual(
          Object.assign(
            Error('Errors in GraphQL query, check .errors property'),
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
  });

  test('scheduler logs to console', async () => {
    const { client } = await createTestClient();

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
      client.query.throw;

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
});

describe('array accessors', () => {
  test('array query', async () => {
    const { client, resolved } = await createTestClient();

    const data = await resolved(() => {
      const human = client.query.human();
      return human.sons.map((son) => {
        return son.name;
      });
    });

    expect(data).toEqual(['default', 'default']);

    const cachedDataHumanOutOfSize = await resolved(() => {
      const human = client.query.human();
      return human.sons[2];
    });

    expect(cachedDataHumanOutOfSize).toBe(undefined);
  });
});

describe('accessor undefined paths', () => {
  test('undefined object path', async () => {
    const { client } = await createTestClient();

    //@ts-expect-error
    const shouldBeUndefined = client.query.other;

    expect(shouldBeUndefined).toBe(undefined);
  });

  test('undefined schema root path', async () => {
    const { client } = await createTestClient();

    //@ts-expect-error
    const shouldBeUndefined = client.other;

    expect(shouldBeUndefined).toBe(undefined);
  });

  test('intentionally manipulated schema', async () => {
    const { client } = await createTestClient({
      query: {
        other: {
          __type: 'error',
        },
      },
      wrongroot: false as any,
    });

    expect(() => {
      //@ts-expect-error
      client.query.other;
    }).toThrow('GraphQL Type not found!');

    expect(
      //@ts-expect-error
      client.wrongroot
    ).toBe(undefined);
  });
});

describe('mutation', () => {
  test('mutation usage', async () => {
    const { client, resolved } = await createTestClient();

    const data = await resolved(() => {
      return client.mutation.sendNotification({
        message: 'hello world',
      });
    });

    expect(data).toBe(true);
  });
});

// TODO: It's a false positive, until subscriptions are implemented
test('subscription usage', async () => {
  const { client, resolved } = await createTestClient();

  await resolved(() => {
    return client.subscription.newNotification;
  }).then((data) => {
    expect(data).toBe(null);
  });
});
