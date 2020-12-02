import { merge } from 'lodash';
import { createTestApp, gql } from 'test-utils';

import { generate } from '@dish/gqless-cli';

import { createClient, DeepPartial, QueryFetcher, Schema } from '../src';

export type Maybe<T> = T | null;
export type Human = {
  name: string;
  father: Human;
  nullFather?: Maybe<Human>;
  sons: Human[];
};

export interface TestClientConfig {
  artificialDelay?: number;
}
export const createTestClient = async (
  addedToGeneratedSchema?: DeepPartial<Schema>,
  queryFetcher?: QueryFetcher,
  config?: TestClientConfig
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
        stringArg(arg: String!): String!
        human(name: String): Human
        nFetchCalls: Int!
        throw: Boolean
        throw2: Boolean
        nullArray: [Human]
        nullStringArray: [String]
        time: String!
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
    };
    mutation: {
      sendNotification(args: { message: string }): boolean;
    };
    subscription: {
      newNotification: void;
    };
  }>({
    schema: merge(generatedSchema, addedToGeneratedSchema),
    scalarsEnumsHash,
    queryFetcher,
  });
};
