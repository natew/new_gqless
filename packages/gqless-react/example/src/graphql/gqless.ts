import { createClient, QueryFetcher } from '@dish/gqless';
import {
  GeneratedSchema,
  generatedSchema,
  scalarsEnumsHash,
} from './schema.generated';

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

export const client = createClient<GeneratedSchema>({
  schema: generatedSchema,
  scalarsEnumsHash,
  queryFetcher,
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
