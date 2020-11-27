import { Dispatch, useCallback, useMemo, useReducer, useRef } from 'react';

import { createClient, gqlessError, ResolveOptions } from '@dish/gqless';

import { CreateReactClientOptions } from '../client';

export interface UseLazyQueryOptions<TData> extends ResolveOptions<TData> {}

export interface UseLazyQueryState<TData> {
  data: TData | undefined;
  error?: gqlessError;
  isLoading: boolean;
}

type UseLazyQueryReducerAction<TData> =
  | { type: 'success'; data: TData }
  | { type: 'failure'; error: gqlessError }
  | { type: 'loading' };

function UseLazyQueryReducer<TData>(
  state: UseLazyQueryState<TData>,
  action: UseLazyQueryReducerAction<TData>
): UseLazyQueryState<TData> {
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

function InitUseLazyQueryReducer<TData>(): UseLazyQueryState<TData> {
  return {
    data: undefined,
    isLoading: false,
  };
}

export interface UseLazyQuery<
  GeneratedSchema extends {
    query: object;
  }
> {
  <TData = unknown>(
    fn?: (query: GeneratedSchema['query']) => TData,
    options?: UseLazyQueryOptions<TData>
  ): readonly [
    (
      fnArg?: ((query: GeneratedSchema['query']) => TData) | undefined
    ) => Promise<TData>,
    UseLazyQueryState<TData>
  ];
}

export function createUseLazyQuery<
  GeneratedSchema extends {
    query: object;
  }
>(client: ReturnType<typeof createClient>, _opts: CreateReactClientOptions) {
  const { resolved } = client;
  const clientQuery: GeneratedSchema['query'] = client.query;

  const useLazyQuery: UseLazyQuery<GeneratedSchema> = function useLazyQuery<
    TData
  >(
    fn?: (query: typeof clientQuery) => TData,
    { noCache, refetch = true }: UseLazyQueryOptions<TData> = {}
  ) {
    const [state, dispatch] = useReducer(
      UseLazyQueryReducer,
      undefined,
      InitUseLazyQueryReducer
    ) as [UseLazyQueryState<TData>, Dispatch<UseLazyQueryReducerAction<TData>>];

    const fnRef = useRef(fn);
    fnRef.current = fn;

    const queryFn = useCallback(
      (fnArg?: typeof fn) => {
        dispatch({
          type: 'loading',
        });

        const refFn = fnRef.current;

        const functionResolve = fnArg
          ? () => fnArg(clientQuery)
          : refFn
          ? () => refFn(clientQuery)
          : (() => {
              throw new gqlessError(
                'You have to specify a function to be resolved'
              );
            })();

        return resolved<TData>(functionResolve, {
          noCache,
          refetch,
        }).then(
          (data) => {
            dispatch({
              type: 'success',
              data,
            });
            return data;
          },
          (err) => {
            const error = gqlessError.create(err);
            dispatch({
              type: 'failure',
              error,
            });

            throw error;
          }
        );
      },
      [refetch, noCache, fnRef, dispatch]
    );

    return useMemo(() => [queryFn, state] as const, [queryFn, state]);
  };

  return useLazyQuery;
}
