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
}

export const scalarsEnumsHash: ScalarsEnumsHash = {
  String: true,
  Boolean: true,
};
export const generatedSchema = {
  query: {
    __typename: { __type: 'String!' },
    dogs: { __type: '[Dog!]!' },
    time: { __type: 'String!' },
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
  __typename: 'Query';
  dogs: Array<Dog>;
  time: ScalarsEnums['String'];
}

export interface Mutation {
  __typename: 'Mutation';
}

export interface Subscription {
  __typename: 'Subscription';
}

export interface Dog {
  __typename: 'Dog';
  name: ScalarsEnums['String'];
  owner?: Maybe<Human>;
}

export interface Human {
  __typename: 'Human';
  name: ScalarsEnums['String'];
  dogs?: Maybe<Array<Dog>>;
}

export interface GeneratedSchema {
  query: Query;
  mutation: Mutation;
  subscription: Subscription;
}

export interface ScalarsEnums extends Scalars {}

const queryFetcher: QueryFetcher = async function (query, variables) {
  const response = await fetch('http://localhost:4141/api/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables,
    }),
    mode: 'cors',
  });

  if (!response.ok) {
    throw new Error(`Network error, received status code ${response.status}`);
  }

  const json = await response.json();

  return json;
};

export const client = createClient<GeneratedSchema>(
  generatedSchema,
  scalarsEnumsHash,
  queryFetcher
);

export const {
  query,
  mutation,
  subscription,
  resolved,
  refetch,
  selectFields,
} = client;
