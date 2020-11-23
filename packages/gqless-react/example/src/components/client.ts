import { createReactClient } from '../../../';
import { client, GeneratedSchema } from '../graphql/gqless';

export const defaultSuspense = true;

export const {
  useTransactionQuery,
  useQuery,
  state,
  graphql,
} = createReactClient<GeneratedSchema>(client, {
  defaultSuspense,
});

export const { refetch } = client;
