import { Dispatch, useCallback, useMemo, useReducer, useRef } from 'react';

import { createClient, gqlessError } from '@dish/gqless';

import { CreateReactClientOptions } from '../client';
import { FetchPolicy, fetchPolicyDefaultResolveOptions } from '../common';

export interface UseLazyQueryOptions<TData> {
  onCompleted?: (data: TData) => void;
  onError?: (error: gqlessError) => void;
  fetchPolicy?: FetchPolicy;
}

export interface UseLazyQueryState<TData> {
  data: TData | undefined;
  error?: gqlessError;
  isLoading: boolean;
  isCalled: boolean;
}

type UseLazyQueryReducerAction<TData> =
  | { type: 'cache-found'; data: TData }
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
        isCalled: true,
      };
    }
    case 'success': {
      return {
        data: action.data,
        isLoading: false,
        isCalled: true,
      };
    }
    case 'failure': {
      return {
        data: state.data,
        isLoading: false,
        error: action.error,
        isCalled: true,
      };
    }
    case 'cache-found': {
      return {
        data: action.data,
        isLoading: state.isLoading,
        isCalled: true,
      };
    }
  }
}

function InitUseLazyQueryReducer<TData>(): UseLazyQueryState<TData> {
  return {
    data: undefined,
    isLoading: false,
    isCalled: false,
  };
}

export interface UseLazyQuery<
  GeneratedSchema extends {
    query: object;
  }
> {
  <TData = unknown, TArgs = undefined>(
    queryFn: (query: GeneratedSchema['query'], args: TArgs) => TData,
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
    fn: (query: typeof clientQuery, args: TArgs) => TData,
    opts: UseLazyQueryOptions<TData> = {}
  ) {
    const [state, dispatch] = useReducer(
      UseLazyQueryReducer,
      undefined,
      InitUseLazyQueryReducer
    ) as [UseLazyQueryState<TData>, Dispatch<UseLazyQueryReducerAction<TData>>];

    const stateRef = useRef(state);
    stateRef.current = state;

    const fnRef = useRef(fn);
    fnRef.current = fn;

    const optsRef = useRef(opts);
    optsRef.current = opts;

    const queryFn = useCallback(
      function callback(callbackArgs: { fn?: typeof fn; args?: any } = {}) {
        dispatch({
          type: 'loading',
        });

        const { fn: fnArg, args } = callbackArgs;

        const refFn = fnRef.current;

        const functionResolve = fnArg
          ? () => fnArg(clientQuery, args)
          : refFn
          ? () => refFn(clientQuery, args)
          : (() => {
              throw new gqlessError(
                'You have to specify a function to be resolved',
                {
                  caller: callback,
                }
              );
            })();

        const { fetchPolicy } = optsRef.current;

        const resolveOptions = fetchPolicyDefaultResolveOptions(fetchPolicy);

        return resolved<TData>(functionResolve, {
          ...resolveOptions,
          onCacheData(data): boolean {
            switch (fetchPolicy) {
              case 'cache-and-network': {
                dispatch({
                  type: 'cache-found',
                  data,
                });
                stateRef.current.data = data;
                return true;
              }
              case 'cache-first': {
                return false;
              }
              default:
                return true;
            }
          },
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
