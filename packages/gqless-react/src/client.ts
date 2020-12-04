import { createClient } from '@dish/gqless';
import { FetchPolicy } from './common';

import { createGraphqlHOC } from './hoc';
import { createUseMutation } from './mutation/useMutation';
import { createUseLazyQuery } from './query/useLazyQuery';
import { createUsePolling } from './query/usePolling';
import { createUseQuery } from './query/useQuery';
import { createUseRefetch } from './query/useRefetch';
import { createUseTransactionQuery } from './query/useTransactionQuery';
import { createSSRHelpers } from './ssr';

export interface CreateReactClientOptions {
  defaultSuspense?: boolean;
  defaultFetchPolicy?: FetchPolicy;
}

export function createReactClient<
  GeneratedSchema extends {
    query: object;
    mutation: object;
    subscription: object;
  }
>(
  client: ReturnType<typeof createClient>,
  opts: CreateReactClientOptions = {}
) {
  const state = new Proxy(
    {
      isLoading: false,
    },
    {
      get(target, key, receiver) {
        if (key === 'isLoading') {
          return Boolean(client.scheduler.resolving);
        }
        return Reflect.get(target, key, receiver);
      },
    }
  );

  const { prepareReactRender, useHydrateCache } = createSSRHelpers(client);

  return {
    useQuery: createUseQuery<GeneratedSchema>(client, opts),
    useRefetch: createUseRefetch(client, opts),
    useLazyQuery: createUseLazyQuery<GeneratedSchema>(client, opts),
    useTransactionQuery: createUseTransactionQuery<GeneratedSchema>(
      client,
      opts
    ),
    useMutation: createUseMutation<GeneratedSchema>(client, opts),
    usePolling: createUsePolling(client, opts),
    graphql: createGraphqlHOC(client, opts),
    state,
    prepareReactRender,
    useHydrateCache,
  };
}
