import getPort from 'get-port';
import { createTestApp, gql } from 'test-utils';

import { generate } from '../../gqless-cli';
import { createSubscriptionsClient } from '../../gqless-subscriptions';
import {
  ClientOptions,
  createClient,
  DeepPartial,
  QueryFetcher,
  Schema,
  SchemaUnionsKey,
  SubscriptionsClient,
} from '../src';
import { deepAssign } from '../src/Utils';

type ObjectTypesNames = 'Human' | 'Query' | 'Mutation' | 'Subscription';

type ObjectTypes = {
  Human: Human;
  Query: {
    __typename: 'Query';
  };
  Mutation: {
    __typename: 'Mutation';
  };
  Subscription: {
    __typename: 'Subscription';
  };
};

export type Maybe<T> = T | null;
export type Human = {
  __typename: 'Human';
  id?: string;
  name: string;
  father: Human;
  nullFather?: Maybe<Human>;
  sons: Human[];
  dogs: Dog[];
};
export type Dog = {
  __typename: 'Dog';
  id?: string;
  name: string;
  owner?: Human;
};
export type Species =
  | {
      __typename: 'Human';
      id?: string;
      name: string;
      father: Human;
      nullFather?: Maybe<Human>;
      sons: Human[];
      dogs: Dog[];
      owner?: undefined;
    }
  | {
      __typename: 'Dog';
      id?: string;
      name: string;
      owner?: Human;
      father?: undefined;
      nullFather?: undefined;
      sons?: undefined;
      dogs?: undefined;
    };

export interface TestClientConfig {
  artificialDelay?: number;
  subscriptions?: boolean;
}
export const createTestClient = async (
  addedToGeneratedSchema?: DeepPartial<Schema>,
  queryFetcher?: QueryFetcher,
  config?: TestClientConfig,
  clientConfig: Partial<ClientOptions<ObjectTypesNames, ObjectTypes>> = {}
) => {
  let dogId = 0;
  const dogs: { name: string; id: number }[] = [
    {
      id: ++dogId,
      name: 'a',
    },
    {
      id: ++dogId,
      name: 'b',
    },
  ];
  let humanId = 0;
  const humanIds: Record<string, number> = {};
  const createHuman = (name: string = 'default') => {
    return {
      id: (humanIds[name] ??= ++humanId),
      name,
      dogs,
      father: {},
    };
  };
  let nFetchCalls = 0;
  let throwTry = 0;
  const { server, client: mercuriusTestClient, isReady } = createTestApp({
    schema: gql`
      type Query {
        hello: String!
        stringArg(arg: String!): String!
        human(name: String): Human
        nFetchCalls: Int!
        throw: Boolean
        throw2: Boolean
        nullArray: [Human]
        nullStringArray: [String]
        time: String!
        species: [Species!]!
        throwUntilThirdTry: Boolean!
        dogs: [Dog!]!
      }
      type Mutation {
        sendNotification(message: String!): Boolean!
        humanMutation(nameArg: String!): Human
      }
      type Subscription {
        newNotification: String!
      }
      type Human {
        id: ID
        name: String!
        father: Human!
        nullFather: Human
        sons: [Human!]!
        dogs: [Dog!]!
      }
      type Dog {
        id: ID
        name: String!
        owner: Human
      }
      union Species = Human | Dog
    `,
    resolvers: {
      Query: {
        throwUntilThirdTry() {
          throwTry++;
          if (throwTry < 3) {
            throw Error('try again, throwTry=' + throwTry);
          }
          throwTry = 0;
          return true;
        },
        stringArg(_root, { arg }: { arg: string }) {
          return arg;
        },
        hello() {
          return 'hello world';
        },
        human(_root, { name }: { name?: string }) {
          return createHuman(name);
        },
        nFetchCalls() {
          return nFetchCalls;
        },
        nullArray() {
          return null;
        },
        nullStringArray() {
          return null;
        },
        async throw() {
          throw Error('expected error');
        },
        async throw2() {
          throw Error('expected error 2');
        },
        time() {
          return new Date().toISOString();
        },
        species() {
          return [createHuman(), ...dogs];
        },
        dogs() {
          return dogs;
        },
      },
      Dog: {
        owner({ name }: { name: string }) {
          return createHuman(name + '-owner');
        },
      },
      Mutation: {
        sendNotification(_root, { message }: { message: string }, ctx) {
          ctx.pubsub.publish({
            topic: 'NOTIFICATION',
            payload: {
              newNotification: message,
            },
          });

          return true;
        },
        humanMutation(_root, { nameArg }: { nameArg: string }) {
          return createHuman(nameArg);
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
        dogs() {
          return dogs;
        },
      },
      Species: {
        resolveType(v: Species) {
          if ('father' in v) return 'Human';
          return 'Dog';
        },
      },
    },
    async context() {
      nFetchCalls++;

      if (config?.artificialDelay) {
        await new Promise((resolve) =>
          setTimeout(resolve, config.artificialDelay)
        );
      }
      return {};
    },
    subscription: true,
  });

  await isReady;

  const { generatedSchema, scalarsEnumsHash } = await generate(
    server.graphql.schema
  );

  const [existingUnionKey] = Object.getOwnPropertySymbols(generatedSchema);

  if (existingUnionKey)
    Reflect.set(
      generatedSchema,
      SchemaUnionsKey,
      Reflect.get(generatedSchema, existingUnionKey)
    );

  if (queryFetcher == null) {
    queryFetcher = (query, variables) => {
      return mercuriusTestClient.query(query, {
        variables,
      });
    };
  }

  let subscriptionsClient: SubscriptionsClient | undefined;

  if (config?.subscriptions) {
    let port: number;
    const address = server.server.address();
    if (typeof address === 'object' && address) {
      port = address.port;
    } else {
      server.log.warn('Remember to close the app instance manually');

      await server.listen((port = await getPort()));
    }
    subscriptionsClient = config?.subscriptions
      ? createSubscriptionsClient({
          wsEndpoint: `ws://127.0.0.1:${port}/graphql`,
        })
      : undefined;
  }

  return Object.assign(
    createClient<
      {
        query: {
          hello: string;
          stringArg: (args: { arg: string }) => string;
          human: (args?: { name?: string }) => Human;
          nullArray?: Maybe<Array<Maybe<Human>>>;
          nullStringArray?: Maybe<Array<Maybe<string>>>;
          nFetchCalls: number;
          throw?: boolean;
          throw2?: boolean;
          time: string;
          species: Array<Species>;
          throwUntilThirdTry: boolean;
          dogs: Array<Dog>;
        };
        mutation: {
          sendNotification(args: { message: string }): boolean;
          humanMutation: (args?: { nameArg?: string }) => Human;
        };
        subscription: {
          newNotification: string | null | undefined;
        };
      },
      ObjectTypesNames,
      ObjectTypes
    >({
      schema: deepAssign(generatedSchema, [addedToGeneratedSchema]) as Schema,
      scalarsEnumsHash,
      queryFetcher,
      subscriptionsClient,
      ...clientConfig,
    }),
    {
      server,
      mercuriusTestClient,
    }
  );
};

export const sleep = (amount: number) =>
  new Promise((resolve) => setTimeout(resolve, amount));
