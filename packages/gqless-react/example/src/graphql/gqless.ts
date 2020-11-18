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

const scalarsEnumsHash: ScalarsEnumsHash = { String: true, Boolean: true };
export const generatedSchema = {
  query: { hello: { __type: 'String!' } },
  mutation: {},
  subscription: {},
} as const;

export interface Query {
  hello: ScalarsEnums['String'];
}

export interface Mutation {}

export interface Subscription {}

export interface GeneratedSchema {
  query: Query;
  mutation: Mutation;
  subscription: Subscription;
}

export interface ScalarsEnums extends Scalars {}

const queryFetcher: QueryFetcher = async function (query, variables) {
  const response = await fetch('/api/graphql', {
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

export const { client, resolved, selectFields } = createClient<GeneratedSchema>(
  generatedSchema,
  scalarsEnumsHash,
  queryFetcher
);

export const { query, mutation, subscription } = client;
