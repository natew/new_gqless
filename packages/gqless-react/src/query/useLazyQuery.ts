import { Dispatch, useCallback, useReducer, useRef } from 'react';

import { createClient, gqlessError, ResolveOptions } from '@dish/gqless';

import { CreateReactClientOptions } from '../client';
import { useIsMounted } from '../common';

export interface UseLazyQueryOptions extends ResolveOptions {}

export interface UseLazyQueryState<A> {
  data: A | undefined;
  error?: gqlessError;
  isLoading: boolean;
}

type UseLazyQueryReducerAction<A> =
  | { type: 'success'; data: A }
  | { type: 'failure'; error: gqlessError }
  | { type: 'loading' };

function UseLazyQueryReducer<A>(
  state: UseLazyQueryState<A>,
  action: UseLazyQueryReducerAction<A>
): UseLazyQueryState<A> {
  switch (action.type) {
    case 'loading': {
      if (state.isLoading) return state;
      return {
        data: state.data,
        isLoading: true,
      };
    }
    case 'success': {
      return {
        data: action.data,
        isLoading: false,
      };
    }
    case 'failure': {
      return {
        data: state.data,
        isLoading: false,
        error: action.error,
      };
    }
  }
}

function InitUseLazyQueryReducer<A>(): UseLazyQueryState<A> {
  return {
    data: undefined,
    isLoading: false,
  };
}

export function createUseLazyQuery<
  GeneratedSchema extends {
    query: object;
    mutation: object;
    subscription: object;
  }
>(client: ReturnType<typeof createClient>, _opts: CreateReactClientOptions) {
  const { resolved } = client;
  const clientQuery: GeneratedSchema['query'] = client.query;

  return function useLazyQuery<A>(
    fn: (query: typeof clientQuery) => A,
    { noCache, refetch = true }: UseLazyQueryOptions = {}
  ) {
    const [state, dispatch] = useReducer(
      UseLazyQueryReducer,
      undefined,
      InitUseLazyQueryReducer
    ) as [UseLazyQueryState<A>, Dispatch<UseLazyQueryReducerAction<A>>];

    const fnRef = useRef(fn);
    fnRef.current = fn;

    const isMounted = useIsMounted();

    const queryFn = useCallback(
      (fnArg?: typeof fn) => {
        if (isMounted.current)
          dispatch({
            type: 'loading',
          });

        return resolved<A>(
          (fnArg ? () => fnArg(clientQuery) : false) ||
            (() => fnRef.current(clientQuery)),
          {
            noCache,
            refetch,
          }
        ).then(
          (data) => {
            if (isMounted.current)
              dispatch({
                type: 'success',
                data,
              });
            return data;
          },
          (err) => {
            if (isMounted.current)
              dispatch({
                type: 'failure',
                error: gqlessError.create(err),
              });

            throw err;
          }
        );
      },
      [refetch, noCache, fnRef, dispatch]
    );

    return [queryFn, state] as const;
  };
}
