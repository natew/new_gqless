import { Dispatch, useCallback, useMemo, useReducer, useRef } from 'react';

import { createClient, gqlessError, ResolveOptions } from '@dish/gqless';

import { CreateReactClientOptions } from '../client';
import { useBatchDispatch } from '../common';

export interface UseMutationOptions<A>
  extends Pick<ResolveOptions<A>, 'noCache'> {}

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
    mutationOptions?: UseMutationOptions<A>
  ) {
    const opts = Object.assign({}, mutationOptions);

    const optsRef = useRef(opts);
    optsRef.current = opts;

    const [state, dispatchReducer] = useReducer(
      UseMutationReducer,
      undefined,
      InitUseMutationReducer
    ) as [UseMutationState<A>, Dispatch<UseMutationReducerAction<A>>];
    const dispatch = useBatchDispatch(dispatchReducer);

    const fnRef = useRef(fn);
    fnRef.current = fn;

    const mutate = useCallback(
      (fnArg?: typeof fn) => {
        dispatch({ type: 'loading' });

        return resolved<A>(
          (fnArg ? () => fnArg(clientMutation) : false) ||
            (() => fnRef.current(clientMutation)),
          {
            noCache: optsRef.current.noCache,
            refetch: true,
          }
        ).then(
          (data) => {
            dispatch({
              type: 'success',
              data,
            });

            return data;
          },
          (err: unknown) => {
            const error = gqlessError.create(err);
            dispatch({
              type: 'failure',
              error,
            });

            throw error;
          }
        );
      },
      [optsRef, fnRef, dispatch]
    );

    return useMemo(() => [mutate, state] as const, [mutate, state]);
  };
}
