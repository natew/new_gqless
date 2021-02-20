import { ScalarsEnumsHash, SchemaUnionsKey } from '@dish/gqless';

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

export const scalarsEnumsHash: ScalarsEnumsHash = {
  String: true,
  Boolean: true,
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
  },
  mutation: {},
  subscription: {},
  Dog: {
    __typename: { __type: 'String!' },
    name: { __type: 'String!' },
    owner: { __type: 'Human' },
  },
  Human: {
    __typename: { __type: 'String!' },
    name: { __type: 'String!' },
    dogs: { __type: '[Dog!]' },
  },
} as const;

export interface Query {
  __typename: 'Query' | null;
  expectedError: ScalarsEnums['Boolean'];
  expectedNullableError?: Maybe<ScalarsEnums['Boolean']>;
  thirdTry: ScalarsEnums['Boolean'];
  dogs: Array<Dog>;
  time: ScalarsEnums['String'];
  stringList: Array<ScalarsEnums['String']>;
}

export interface Mutation {
  __typename: 'Mutation' | null;
}

export interface Subscription {
  __typename: 'Subscription' | null;
}

export interface Dog {
  __typename: 'Dog' | null;
  name: ScalarsEnums['String'];
  owner?: Maybe<Human>;
}

export interface Human {
  __typename: 'Human' | null;
  name: ScalarsEnums['String'];
  dogs?: Maybe<Array<Dog>>;
}

export interface GeneratedSchema {
  query: Query;
  mutation: Mutation;
  subscription: Subscription;
}

export type MakeNullable<T> = {
  [K in keyof T]: T[K] | null;
};

export interface ScalarsEnums extends MakeNullable<Scalars> {}
