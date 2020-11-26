import { createReactClient } from '../../../';
import { client, GeneratedSchema } from '../graphql/gqless';

export const defaultSuspense = false;

export const {
  useTransactionQuery,
  useQuery,
  state,
  graphql,
  useRefetch,
} = createReactClient<GeneratedSchema>(client, {
  defaultSuspense,
});

export const { refetch } = client;
