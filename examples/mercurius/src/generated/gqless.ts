import { createMercuriusTestClient } from 'mercurius-integration-testing';
import { app } from '../';

import { createClient, QueryFetcher, ScalarsEnumsHash } from '@dish/gqless';

export type Maybe<T> = T | null;
export type Exact<T extends { [key: string]: unknown }> = {
  [K in keyof T]: T[K];
};
/** All built-in and custom scalars, mapped to their actual values */
export interface Scalars {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
  ExampleScalar: string;
}

export enum GreetingsEnum {
  Hello = 'Hello',
  Hi = 'Hi',
  Hey = 'Hey',
}

export interface GreetingsInput {
  language: Scalars['String'];
  value?: Maybe<Scalars['String']>;
  scal?: Maybe<Scalars['ExampleScalar']>;
}

export const scalarsEnumsHash: ScalarsEnumsHash = {
  ExampleScalar: true,
  GreetingsEnum: true,
  String: true,
  Int: true,
  Boolean: true,
};
export const generatedSchema = {
  query: {
    __typename: { __type: 'String!' },
    simpleString: { __type: 'String!' },
    stringWithArgs: { __type: 'String!', __args: { hello: 'String!' } },
    stringNullableWithArgs: {
      __type: 'String',
      __args: { hello: 'String!', helloTwo: 'String' },
    },
    stringNullableWithArgsArray: {
      __type: 'String',
      __args: { hello: '[String]!' },
    },
    object: { __type: 'Human' },
    objectArray: { __type: '[Human]' },
    objectWithArgs: { __type: 'Human!', __args: { who: 'String!' } },
    arrayString: { __type: '[String!]!' },
    arrayObjectArgs: { __type: '[Human!]!', __args: { limit: 'Int!' } },
    greetings: { __type: 'GreetingsEnum!' },
    giveGreetingsInput: {
      __type: 'String!',
      __args: { input: 'GreetingsInput!' },
    },
    number: { __type: 'Int!' },
  },
  mutation: {
    __typename: { __type: 'String!' },
    increment: { __type: 'Int!', __args: { n: 'Int!' } },
  },
  subscription: {},
  GreetingsInput: {
    language: { __type: 'String!' },
    value: { __type: 'String' },
    scal: { __type: 'ExampleScalar' },
  },
  Human: {
    __typename: { __type: 'String!' },
    name: { __type: 'String!' },
    father: { __type: 'Human!' },
    fieldWithArgs: { __type: 'Int!', __args: { id: 'Int!' } },
    sons: { __type: '[Human!]' },
  },
} as const;

export interface Query {
  __typename: 'Query';
  simpleString: ScalarsEnums['String'];
  stringWithArgs: (args: {
    hello: ScalarsEnums['String'];
  }) => ScalarsEnums['String'];
  stringNullableWithArgs: (args: {
    hello: ScalarsEnums['String'];
    helloTwo?: Maybe<ScalarsEnums['String']>;
  }) => Maybe<ScalarsEnums['String']>;
  stringNullableWithArgsArray: (args: {
    hello: Array<Maybe<ScalarsEnums['String']>>;
  }) => Maybe<ScalarsEnums['String']>;
  object: Maybe<Human>;
  objectArray: Maybe<Array<Maybe<Human>>>;
  objectWithArgs: (args: { who: ScalarsEnums['String'] }) => Human;
  arrayString: Array<ScalarsEnums['String']>;
  arrayObjectArgs: (args: { limit: ScalarsEnums['Int'] }) => Array<Human>;
  greetings: ScalarsEnums['GreetingsEnum'];
  giveGreetingsInput: (args: {
    input: GreetingsInput;
  }) => ScalarsEnums['String'];
  number: ScalarsEnums['Int'];
}

export interface Mutation {
  __typename: 'Mutation';
  increment: (args: { n: ScalarsEnums['Int'] }) => ScalarsEnums['Int'];
}

export interface Subscription {
  __typename: 'Subscription';
}

export interface Human {
  __typename: 'Human';
  name: ScalarsEnums['String'];
  father: Human;
  fieldWithArgs: (args: { id: ScalarsEnums['Int'] }) => ScalarsEnums['Int'];
  sons: Maybe<Array<Human>>;
}

export interface GeneratedSchema {
  query: Query;
  mutation: Mutation;
  subscription: Subscription;
}

export interface ScalarsEnums extends Scalars {
  GreetingsEnum: GreetingsEnum;
}

const testClient = createMercuriusTestClient(app);
const queryFetcher: QueryFetcher = function (query, variables) {
  return testClient.query(query, {
    variables,
  });
};

export const client = createClient<GeneratedSchema>({
  schema: generatedSchema,
  scalarsEnumsHash,
  queryFetcher,
});

export const { query, mutation, subscription, resolved } = client;
