import { createMercuriusTestClient } from 'mercurius-integration-testing';

import { createClient, QueryFetcher } from '@dish/gqless';

import { app } from '../';
import {
  GeneratedSchema,
  generatedSchema,
  scalarsEnumsHash,
} from './schema.generated';

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

export const {
  query,
  mutation,
  mutate,
  subscription,
  resolved,
  refetch,
} = client;

export * from './schema.generated';
