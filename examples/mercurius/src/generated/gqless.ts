import { createMercuriusTestClient } from 'mercurius-integration-testing';

import {
  createClient,
  QueryFetcher,
  ScalarsEnumsHash,
  Schema,
} from '@dish/gqless';

import { app } from '../';

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

const scalarsEnumsHash: ScalarsEnumsHash = {
  ExampleScalar: true,
  GreetingsEnum: true,
  String: true,
  Int: true,
  Boolean: true,
};
const generatedSchema: Schema = {
  query: {
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
  },
  GreetingsInput: {
    language: { __type: 'String!' },
    value: { __type: 'String' },
    scal: { __type: 'ExampleScalar' },
  },
  Human: {
    name: { __type: 'String!' },
    father: { __type: 'Human!' },
    fieldWithArgs: { __type: 'Int!', __args: { id: 'Int!' } },
  },
};

export interface Query {
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
}

export interface Human {
  name: ScalarsEnums['String'];
  father: Human;
  fieldWithArgs: (args: { id: ScalarsEnums['Int'] }) => ScalarsEnums['Int'];
}

export interface GeneratedSchema {
  query: Query;
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

export const { client, resolveAllSelections, resolved } = createClient<
  GeneratedSchema
>(generatedSchema, scalarsEnumsHash, queryFetcher);
