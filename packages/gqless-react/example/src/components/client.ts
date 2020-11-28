import { createLogger } from '@dish/gqless-logger';

import { createReactClient } from '../../../';
import { client, GeneratedSchema } from '../graphql/gqless';

export const defaultSuspense = false;

export const {
  useTransactionQuery,
  useQuery,
  state,
  graphql,
  useRefetch,
  usePolling,
} = createReactClient<GeneratedSchema>(client, {
  defaultSuspense,
});

if (typeof window !== 'undefined') {
  const logger = createLogger(client, {});
  logger.start();
}

export const { refetch } = client;
