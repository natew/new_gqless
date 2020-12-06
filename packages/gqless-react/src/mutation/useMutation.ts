import { Dispatch, useCallback, useMemo, useReducer, useRef } from 'react';

import { createClient, gqlessError, ResolveOptions } from '@dish/gqless';

import { CreateReactClientOptions } from '../client';
import { useDeferDispatch } from '../common';

export interface UseMutationOptions<TData>
  extends Pick<ResolveOptions<TData>, 'noCache'> {}

export interface UseMutationState<TData> {
  data: TData | undefined;
  error?: gqlessError;
  isLoading: boolean;
}

type UseMutationReducerAction<TData> =
  | { type: 'success'; data: TData }
  | { type: 'failure'; error: gqlessError }
  | { type: 'loading' };

function UseMutationReducer<TData>(
  state: UseMutationState<TData>,
  action: UseMutationReducerAction<TData>
): UseMutationState<TData> {
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

function InitUseMutationReducer<TData>(): UseMutationState<TData> {
  return {
    data: undefined,
    isLoading: false,
  };
}

export interface UseMutation<
  GeneratedSchema extends {
    mutation: object;
  }
> {
  <TData = unknown>(
    fn?: (mutation: GeneratedSchema['mutation']) => TData,
    options?: UseMutationOptions<TData>
  ): readonly [
    (
      fnArg?: ((mutation: GeneratedSchema['mutation']) => TData) | undefined
    ) => Promise<TData>,
    UseMutationState<TData>
  ];
}

export function createUseMutation<
  GeneratedSchema extends {
    mutation: object;
  }
>(client: ReturnType<typeof createClient>, _opts: CreateReactClientOptions) {
  const { resolved } = client;
  const clientMutation: GeneratedSchema['mutation'] = client.mutation;

  const useMutation: UseMutation<GeneratedSchema> = function useMutation<TData>(
    fn?: (mutation: typeof clientMutation) => TData,
    mutationOptions?: UseMutationOptions<TData>
  ) {
    const opts = Object.assign({}, mutationOptions);

    const optsRef = useRef(opts);
    optsRef.current = opts;

    const [state, dispatchReducer] = useReducer(
      UseMutationReducer,
      undefined,
      InitUseMutationReducer
    ) as [UseMutationState<TData>, Dispatch<UseMutationReducerAction<TData>>];
    const dispatch = useDeferDispatch(dispatchReducer);

    const fnRef = useRef(fn);
    fnRef.current = fn;

    const mutate = useCallback(
      (fnArg?: typeof fn) => {
        dispatch({ type: 'loading' });

        const refFn = fnRef.current;

        const functionResolve = fnArg
          ? () => fnArg(clientMutation)
          : refFn
          ? () => refFn(clientMutation)
          : (() => {
              throw new gqlessError(
                'You have to specify a function to be resolved'
              );
            })();

        return resolved<TData>(functionResolve, {
          noCache: optsRef.current.noCache,
          refetch: true,
        }).then(
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

  return useMutation;
}
