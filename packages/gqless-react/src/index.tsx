import { createClient } from '@dish/gqless';
import { useState, useEffect, useCallback, useRef } from 'react';

export function createReactClient<
  GeneratedSchema extends {
    query: object;
    mutation: object;
    subscription: object;
  } = never
>(client: ReturnType<typeof createClient>) {
  const { resolved } = client;
  const clientQuery: GeneratedSchema['query'] = client.query;
  const clientMutation: GeneratedSchema['mutation'] = client.mutation;

  function useQuery<A>(fn: (query: typeof clientQuery) => A) {
    const [data, setState] = useState<A>();

    useEffect(() => {
      resolved<A>(() => fn(clientQuery)).then(setState);
    }, []);

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
    useMutation,
  };
}
