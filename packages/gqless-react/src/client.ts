import { createClient, RetryOptions } from '@dish/gqless';

import { FetchPolicy } from './common';
import { createGraphqlHOC } from './hoc';
import { createUseMutation } from './mutation/useMutation';
import { createUseLazyQuery } from './query/useLazyQuery';
import { createUseMetaState } from './query/useMetaState';
import { createUsePolling } from './query/usePolling';
import { createUseQuery } from './query/useQuery';
import { createUseRefetch } from './query/useRefetch';
import { createUseTransactionQuery } from './query/useTransactionQuery';
import { createSSRHelpers } from './ssr';

import type { ReactClientOptionsWithDefaults } from './utils';

export interface ReactClientDefaults {
  /**
   * Enable/Disable by default 'React Suspense' behavior
   *
   * > _Valid for __graphql HOC__ & __useQuery___
   *
   * > _You can override it on a per-function basis_
   *
   * @default true
   */
  suspense?: boolean;
  /**
   * Enable/Disable by default 'React Suspense' behavior for useLazyQuery hook
   *
   * > _Valid only for __useLazyQuery___
   *
   * > _You can override it on a per-hook basis_
   *
   * @default false
   */
  lazyQuerySuspense?: boolean;
  /**
   * Enable/Disable by default 'React Suspense' behavior for useTransactionQuery hook
   *
   * > _Valid only for __useLazyQuery___
   *
   * > _You can override it on a per-hook basis_
   *
   * __The _default value_ is obtained from the "`defaults.suspense`" value__
   */
  transactionQuerySuspense?: boolean;
  /**
   * Enable/Disable by default 'React Suspense' behavior for useMutation hook
   *
   * > _Valid only for __useMutation___
   *
   * > _You can override it on a per-hook basis_
   *
   * @default false
   */
  mutationSuspense?: boolean;

  /**
   * Define default 'fetchPolicy' hooks behaviour
   *
   * > _Valid for __useTransactionQuery___
   *
   * > _You can override it on a per-hook basis_
   *
   * @default "cache-first"
   */
  transactionFetchPolicy?: FetchPolicy;
  /**
   * Define default 'fetchPolicy' hooks behaviour
   *
   * > _Valid for __useLazyQuery__
   *
   * > _You can override it on a per-hook basis_
   *
   * @default "network-only"
   */
  lazyFetchPolicy?: Exclude<FetchPolicy, 'cache-first'>;
  /**
   * __Enable__/__Disable__ default 'stale-while-revalidate' behaviour
   *
   * > _Valid for __graphql HOC__ & __useQuery___
   *
   * > _You can override it on a per-function basis_
   *
   * @default false
   */
  staleWhileRevalidate?: boolean;
  /**
   * Retry on error behaviour
   *
   * _You can override these defaults on a per-hook basis_
   *
   * > _Valid for __useMutation__, __useLazyQuery__, __useTransactionQuery__ & __useRefetch___
   *
   * @default true
   */
  retry?: RetryOptions;
}

export interface CreateReactClientOptions {
  /**
   * Default behaviour values
   */
  defaults?: ReactClientDefaults;
}

export function createReactClient<
  GeneratedSchema extends {
    query: object;
    mutation: object;
    subscription: object;
  }
>(
  client: ReturnType<typeof createClient>,
  optsCreate: CreateReactClientOptions = {}
) {
  const defaults: ReactClientOptionsWithDefaults['defaults'] = {
    transactionFetchPolicy:
      optsCreate.defaults?.transactionFetchPolicy ?? 'cache-first',
    lazyFetchPolicy: optsCreate.defaults?.lazyFetchPolicy ?? 'network-only',
    staleWhileRevalidate: optsCreate.defaults?.staleWhileRevalidate ?? false,
    suspense: optsCreate.defaults?.suspense ?? true,
    retry: optsCreate.defaults?.retry ?? true,
    lazyQuerySuspense: optsCreate.defaults?.lazyQuerySuspense ?? false,
    transactionQuerySuspense:
      optsCreate.defaults?.transactionQuerySuspense ??
      optsCreate.defaults?.suspense ??
      true,
    mutationSuspense: optsCreate.defaults?.mutationSuspense ?? false,
  };

  const opts: ReactClientOptionsWithDefaults = Object.assign({}, optsCreate, {
    defaults,
  });

  const state = new Proxy(
    {
      isLoading: false,
    },
    {
      get(target, key, receiver) {
        if (key === 'isLoading') return Boolean(client.scheduler.resolving);

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
    useMetaState: createUseMetaState(client),
  };
}
