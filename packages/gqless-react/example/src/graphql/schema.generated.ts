import { ScalarsEnumsHash } from '@dish/gqless';

export type Maybe<T> = T | null;
export type Exact<T extends { [key: string]: unknown }> = {
  [K in keyof T]: T[K];
};
export type MakeOptional<T, K extends keyof T> = Omit<T, K> &
  { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> &
  { [SubKey in K]: Maybe<T[SubKey]> };
/** All built-in and custom scalars, mapped to their actual values */
export interface Scalars {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
}

export interface inputTypeExample {
  a: Scalars['String'];
}

export const scalarsEnumsHash: ScalarsEnumsHash = {
  ID: true,
  String: true,
  Boolean: true,
  Int: true,
};
export const generatedSchema = {
  query: {
    __typename: { __type: 'String!' },
    expectedError: { __type: 'Boolean!' },
    expectedNullableError: { __type: 'Boolean' },
    thirdTry: { __type: 'Boolean!' },
    dogs: { __type: '[Dog!]!' },
    time: { __type: 'String!' },
    stringList: { __type: '[String!]!' },
    humans: { __type: '[Human!]!' },
    human1: { __type: 'Human!' },
    human1Other: { __type: 'Human!' },
  },
  mutation: {
    __typename: { __type: 'String!' },
    renameDog: { __type: 'Dog', __args: { id: 'ID!', name: 'String!' } },
    renameHuman: { __type: 'Human', __args: { id: 'ID!', name: 'String!' } },
    other: { __type: 'Int', __args: { arg: 'inputTypeExample!' } },
  },
  subscription: {},
  Dog: {
    __typename: { __type: 'String!' },
    id: { __type: 'ID!' },
    name: { __type: 'String!' },
    owner: { __type: 'Human' },
  },
  Human: {
    __typename: { __type: 'String!' },
    id: { __type: 'ID!' },
    name: { __type: 'String!' },
    dogs: { __type: '[Dog!]' },
  },
  inputTypeExample: { a: { __type: 'String!' } },
} as const;

export interface Query {
  __typename: 'Query' | null;
  expectedError: ScalarsEnums['Boolean'];
  expectedNullableError?: Maybe<ScalarsEnums['Boolean']>;
  thirdTry: ScalarsEnums['Boolean'];
  dogs: Array<Dog>;
  time: ScalarsEnums['String'];
  stringList: Array<ScalarsEnums['String']>;
  humans: Array<Human>;
  human1: Human;
  human1Other: Human;
}

export interface Mutation {
  __typename: 'Mutation' | null;
  renameDog: (args: {
    id: ScalarsEnums['ID'];
    name: ScalarsEnums['String'];
  }) => Maybe<Dog>;
  renameHuman: (args: {
    id: ScalarsEnums['ID'];
    name: ScalarsEnums['String'];
  }) => Maybe<Human>;
  other: (args: { arg: inputTypeExample }) => Maybe<ScalarsEnums['Int']>;
}

export interface Subscription {
  __typename: 'Subscription' | null;
}

export interface Dog {
  __typename: 'Dog' | null;
  id: ScalarsEnums['ID'];
  name: ScalarsEnums['String'];
  owner?: Maybe<Human>;
}

export interface Human {
  __typename: 'Human' | null;
  id: ScalarsEnums['ID'];
  name: ScalarsEnums['String'];
  dogs?: Maybe<Array<Dog>>;
}

export interface SchemaObjectTypes {
  Query: Query;
  Mutation: Mutation;
  Subscription: Subscription;
  Dog: Dog;
  Human: Human;
}
export type SchemaObjectTypesNames =
  | 'Query'
  | 'Mutation'
  | 'Subscription'
  | 'Dog'
  | 'Human';

export interface GeneratedSchema {
  query: Query;
  mutation: Mutation;
  subscription: Subscription;
}

export type MakeNullable<T> = {
  [K in keyof T]: T[K] | null;
};

export interface ScalarsEnums extends MakeNullable<Scalars> {}
