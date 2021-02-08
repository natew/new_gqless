import { Dispatch, useCallback, useMemo, useReducer, useRef } from 'react';

import { createClient, gqlessError, ResolveOptions } from '@dish/gqless';

import { CreateReactClientOptions } from '../client';

export interface UseLazyQueryOptions<TData> extends ResolveOptions<TData> {
  onCompleted?: (data: TData) => void;
  onError?: (error: gqlessError) => void;
}

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
  <TData = unknown, TArgs = undefined>(
    queryFn?: (query: GeneratedSchema['query'], args: TArgs) => TData,
    options?: UseLazyQueryOptions<TData>
  ): readonly [
    (
      ...opts: TArgs extends undefined
        ? [
            {
              fn?: (query: GeneratedSchema['query'], args: TArgs) => TData;
              args?: TArgs;
            }?
          ]
        : [
            {
              fn?: (query: GeneratedSchema['query'], args: TArgs) => TData;
              args: TArgs;
            }
          ]
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
    TData,
    TArgs = undefined
  >(
    fn?: (query: typeof clientQuery, args: TArgs) => TData,
    opts: UseLazyQueryOptions<TData> = {}
  ) {
    const [state, dispatch] = useReducer(
      UseLazyQueryReducer,
      undefined,
      InitUseLazyQueryReducer
    ) as [UseLazyQueryState<TData>, Dispatch<UseLazyQueryReducerAction<TData>>];

    const fnRef = useRef(fn);
    fnRef.current = fn;

    const optsRef = useRef(opts);
    optsRef.current = opts;

    const queryFn = useCallback(
      ({ fn: fnArg, args }: { fn?: typeof fn; args?: any } = {}) => {
        dispatch({
          type: 'loading',
        });

        const refFn = fnRef.current;

        const functionResolve = fnArg
          ? () => fnArg(clientQuery, args)
          : refFn
          ? () => refFn(clientQuery, args)
          : (() => {
              throw new gqlessError(
                'You have to specify a function to be resolved',
                {
                  caller: useLazyQuery,
                }
              );
            })();

        const { noCache, refetch, onCacheData } = optsRef.current;

        return resolved<TData>(functionResolve, {
          noCache,
          refetch,
          onCacheData,
        }).then(
          (data) => {
            optsRef.current.onCompleted?.(data);
            dispatch({
              type: 'success',
              data,
            });
            return data;
          },
          (err) => {
            const error = gqlessError.create(err, useLazyQuery);
            optsRef.current.onError?.(error);
            dispatch({
              type: 'failure',
              error,
            });

            throw error;
          }
        );
      },
      [fnRef, dispatch, optsRef]
    );

    return useMemo(() => [queryFn, state] as const, [queryFn, state]);
  };

  return useLazyQuery;
}
