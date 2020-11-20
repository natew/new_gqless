import debounce from 'lodash/debounce';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIsomorphicLayoutEffect, useUpdate } from './common';

import type { createClient } from '@dish/gqless';

import type { Interceptor } from '@dish/gqless/dist/Interceptor';

export function createReactClient<
  GeneratedSchema extends {
    query: object;
    mutation: object;
    subscription: object;
  } = never
>(client: ReturnType<typeof createClient>) {
  const { resolved, interceptorManager, scheduler } = client;
  const clientQuery: GeneratedSchema['query'] = client.query;
  const clientMutation: GeneratedSchema['mutation'] = client.mutation;

  function useQuery() {
    const interceptorRef = useRef<Interceptor>();
    const updateFn = useUpdate();
    const update = useMemo(() => {
      return debounce(updateFn, 100);
    }, [updateFn]);

    useIsomorphicLayoutEffect(() => {
      const interceptor = interceptorManager.createInterceptor();
      interceptorRef.current = interceptor;

      interceptor.addSelectionListeners.add((select) => {
        console.log(select);
        update();
      });

      return () => {
        interceptorManager.removeInterceptor(interceptor);
      };
    });

    useEffect(() => {
      const resolving = scheduler.resolving;

      if (resolving) {
        resolving.then(update, console.error);
      }
    });
    return clientQuery;
  }

  function useTransactionQuery<A>(
    fn: (query: typeof clientQuery) => A,
    deps: unknown[] = []
  ) {
    const [data, setState] = useState<A>();

    useEffect(() => {
      resolved<A>(() => fn(clientQuery)).then(setState);
    }, deps);

    return {
      data,
    };
  }

  function useMutation<A>(fn: (mutation: typeof clientMutation) => A) {
    const [data, setData] = useState<A>();
    const fnRef = useRef(fn);
    fnRef.current = fn;

    const mutate = useCallback(() => {
      return resolved<A>(() => fnRef.current(clientMutation), {
        refetch: true,
      }).then((data) => {
        setData(data);
        return data;
      });
    }, [fnRef, setData]);

    return [mutate, { data }];
  }

  return {
    useQuery,
    useTransactionQuery,
    useMutation,
  };
}
