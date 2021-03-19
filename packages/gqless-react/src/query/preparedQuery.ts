import { createClient, gqlessError } from '@dish/gqless';
import { SchedulerPromiseValue } from '@dish/gqless/dist/Scheduler';

import {
  useForceUpdate,
  useIsMounted,
  useIsomorphicLayoutEffect,
} from '../common';
import { ReactClientOptionsWithDefaults } from '../utils';

export interface UsePreloadQueryOptions {
  suspense?: boolean;
}

export function createPrepareQuery<
  GeneratedSchema extends {
    query: object;
  }
>(
  { prefetch, query, refetch: refetchClient }: ReturnType<typeof createClient>,
  {
    defaults: { preloadSuspense: defaultSuspense },
  }: ReactClientOptionsWithDefaults
) {
  const emptyDataSymbol = Symbol();

  function prepareQuery<TData, TArgs = undefined>(
    fn: (query: GeneratedSchema['query'], args: TArgs) => TData
  ) {
    const state: {
      data: TData | typeof emptyDataSymbol;
      error?: gqlessError;
      isLoading: boolean;
      called: boolean;
    } = {
      data: emptyDataSymbol,
      isLoading: false,
      called: false,
    };

    let promiseOnTheFly:
      | (Promise<TData> & {
          schedulerPromise: Promise<SchedulerPromiseValue>;
        })
      | undefined;

    const subscribers = new Set<() => void>();

    function updateSubs() {
      for (const cb of subscribers) cb();
    }

    async function refetch(
      ...[args]: TArgs extends undefined ? [args?: TArgs] : [args: TArgs]
    ) {
      state.called = true;
      state.isLoading = true;
      try {
        await refetchClient(() => fn(query, args as TArgs));

        return preload(
          //@ts-expect-error
          args
        );
      } finally {
        state.isLoading = false;
      }
    }

    async function preload(
      ...[args]: TArgs extends undefined ? [args?: TArgs] : [args: TArgs]
    ) {
      state.called = true;
      state.isLoading = true;
      try {
        const result = prefetch<TData>((query) => fn(query, args as TArgs));

        if (result instanceof Promise) {
          promiseOnTheFly = result;
          updateSubs();
          result.schedulerPromise.then(({ error }) => {
            if (error) {
              state.error = error;
            } else {
              delete state.error;
            }
          });
          const data = (state.data = await result);

          if (promiseOnTheFly === result) promiseOnTheFly = undefined;

          return data;
        } else {
          delete state.error;
        }

        return (state.data = result);
      } finally {
        state.isLoading = false;
        updateSubs();
      }
    }

    function usePrepared({
      suspense = defaultSuspense,
    }: UsePreloadQueryOptions) {
      const isMounted = useIsMounted();

      const forceUpdate = useForceUpdate();

      let isLoading = false;

      if (promiseOnTheFly) {
        isLoading = true;
        promiseOnTheFly.then(() => {
          if (isMounted.current) forceUpdate();
        });
        if (suspense) throw promiseOnTheFly;
      }

      useIsomorphicLayoutEffect(() => {
        let isMounted = true;
        const cb = () => isMounted && forceUpdate();
        subscribers.add(cb);

        return () => {
          isMounted = false;
          subscribers.delete(cb);
        };
      }, [forceUpdate]);

      return {
        data: state.data !== emptyDataSymbol ? state.data : undefined,
        isLoading,
        error: state.error,
        called: state.called,
      };
    }

    return {
      preload,
      refetch,
      usePrepared,
      callback: fn,
    };
  }

  return prepareQuery;
}
