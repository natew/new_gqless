import { merge } from 'lodash';
import { createTestApp, gql } from 'test-utils';

import { generate } from '@dish/gqless-cli';

import {
  ClientOptions,
  createClient,
  DeepPartial,
  QueryFetcher,
  Schema,
  SchemaUnionsKey,
} from '../src';

export type Maybe<T> = T | null;
export type Human = {
  __typename: 'Human';
  name: string;
  father: Human;
  nullFather?: Maybe<Human>;
  sons: Human[];
  dogs: Dog[];
};
export type Dog = {
  __typename: 'Dog';
  name: string;
  owner?: Human;
};
export type Species =
  | {
      __typename: 'Human';
      name: string;
      father: Human;
      nullFather?: Maybe<Human>;
      sons: Human[];
      dogs: Dog[];
      owner?: undefined;
    }
  | {
      __typename: 'Dog';
      name: string;
      owner?: Human;
      father?: undefined;
      nullFather?: undefined;
      sons?: undefined;
      dogs?: undefined;
    };

export interface TestClientConfig {
  artificialDelay?: number;
}
export const createTestClient = async (
  addedToGeneratedSchema?: DeepPartial<Schema>,
  queryFetcher?: QueryFetcher,
  config?: TestClientConfig,
  clientConfig: Partial<ClientOptions> = {}
) => {
  const dogs: { name: string }[] = [
    {
      name: 'a',
    },
    {
      name: 'b',
    },
  ];
  const createHuman = (name?: string) => {
    return {
      name: name || 'default',
      dogs,
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
      }
      type Mutation {
        sendNotification(message: String!): Boolean!
        humanMutation(nameArg: String!): Human
      }
      type Subscription {
        newNotification: String
      }
      type Human {
        name: String!
        father: Human!
        nullFather: Human
        sons: [Human!]!
        dogs: [Dog!]!
      }
      type Dog {
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
            payload: message,
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

  return createClient<{
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
    };
    mutation: {
      sendNotification(args: { message: string }): boolean;
      humanMutation: (args?: { nameArg?: string }) => Human;
    };
    subscription: {
      newNotification: void;
    };
  }>({
    schema: merge(generatedSchema, addedToGeneratedSchema) as Schema,
    scalarsEnumsHash,
    queryFetcher,
    ...clientConfig,
  });
};
