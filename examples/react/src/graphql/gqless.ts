import { createClient, QueryFetcher } from '@dish/gqless';
import { createSubscriptionClient } from '@dish/gqless-subscriptions';

import {
  GeneratedSchema,
  generatedSchema,
  scalarsEnumsHash,
  SchemaObjectTypes,
  SchemaObjectTypesNames,
} from './schema.generated';

const queryFetcher: QueryFetcher = async function (query, variables) {
  const response = await fetch(
    typeof window !== 'undefined'
      ? '/api/graphql'
      : 'http://localhost:4141/api/graphql',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables,
      }),
      mode: 'cors',
    }
  );

  if (!response.ok) {
    throw new Error(`Network error, received status code ${response.status}`);
  }

  const json = await response.json();

  return json;
};

export const client = createClient<
  GeneratedSchema,
  SchemaObjectTypesNames,
  SchemaObjectTypes
>({
  schema: generatedSchema,
  scalarsEnumsHash,
  queryFetcher,
  catchSelectionsTimeMS: 10,
  normalization: {
    keyFields: {},
  },
  subscriptions:
    typeof window !== 'undefined'
      ? createSubscriptionClient({
          wsEndpoint: 'ws://localhost:4141/api/graphql',
        })
      : undefined,
});

export const {
  query,
  mutation,
  mutate,
  subscription,
  resolved,
  refetch,
} = client;

export * from './schema.generated';
