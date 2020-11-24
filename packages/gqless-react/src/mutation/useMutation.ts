import { Dispatch, useCallback, useReducer, useRef } from 'react';

import { createClient, gqlessError, ResolveOptions } from '@dish/gqless';

import { CreateReactClientOptions } from '../client';
import { useIsMounted } from '../common';

export interface UseMutationOptions extends ResolveOptions {}

export interface UseMutationState<A> {
  data: A | undefined;
  error?: gqlessError;
  isLoading: boolean;
}

type UseMutationReducerAction<A> =
  | { type: 'success'; data: A }
  | { type: 'failure'; error: gqlessError }
  | { type: 'loading' };

function UseMutationReducer<A>(
  state: UseMutationState<A>,
  action: UseMutationReducerAction<A>
): UseMutationState<A> {
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

function InitUseMutationReducer<A>(): UseMutationState<A> {
  return {
    data: undefined,
    isLoading: false,
  };
}

export function createUseMutation<
  GeneratedSchema extends {
    query: object;
    mutation: object;
    subscription: object;
  }
>(client: ReturnType<typeof createClient>, _opts: CreateReactClientOptions) {
  const { resolved } = client;
  const clientMutation: GeneratedSchema['mutation'] = client.mutation;

  return function useMutation<A>(
    fn: (mutation: typeof clientMutation) => A,
    { noCache, refetch = true }: UseMutationOptions = {}
  ) {
    const [state, dispatch] = useReducer(
      UseMutationReducer,
      undefined,
      InitUseMutationReducer
    ) as [UseMutationState<A>, Dispatch<UseMutationReducerAction<A>>];

    const isMounted = useIsMounted();

    const fnRef = useRef(fn);
    fnRef.current = fn;

    const mutate = useCallback(
      (fnArg?: typeof fn) => {
        if (isMounted.current) dispatch({ type: 'loading' });

        return resolved<A>(
          (fnArg ? () => fnArg(clientMutation) : false) ||
            (() => fnRef.current(clientMutation)),
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

    return [mutate, state] as const;
  };
}
