import { createLogger } from '@dish/gqless-logger';

import { createReactClient } from '@dish/gqless-react';
import { client, GeneratedSchema } from '../graphql/gqless';

export const {
  useTransactionQuery,
  useQuery,
  state,
  graphql,
  useRefetch,
  usePolling,
  useLazyQuery,
  prepareReactRender,
  useHydrateCache,
  useMutation,
  useMetaState,
} = createReactClient<GeneratedSchema>(client, {
  defaults: {
    suspense: true,
    staleWhileRevalidate: false,
  },
});

if (typeof window !== 'undefined') {
  const logger = createLogger(client, {});
  logger.start();
}

export const { refetch, buildSelection } = client;
