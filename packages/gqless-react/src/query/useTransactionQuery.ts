import {
  Dispatch,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';

import { createClient, gqlessError, ResolveOptions } from '@dish/gqless';

import { CreateReactClientOptions } from '../client';
import { IS_BROWSER, useBatchDispatch, useIsFirstMount } from '../common';

export interface UseTransactionQueryState<A> {
  data: A | undefined;
  error?: gqlessError;
  isLoading: boolean;
  called: boolean;
}

type UseTransactionQueryReducerAction<A> =
  | { type: 'success'; data: A }
  | { type: 'failure'; error: gqlessError }
  | { type: 'loading' }
  | {
      type: 'done';
    };

function UseTransactionQueryReducer<A>(
  state: UseTransactionQueryState<A>,
  action: UseTransactionQueryReducerAction<A>
): UseTransactionQueryState<A> {
  switch (action.type) {
    case 'loading': {
      if (state.isLoading) return state;
      return {
        data: state.data,
        isLoading: true,
        called: true,
      };
    }
    case 'success': {
      return {
        data: action.data,
        isLoading: false,
        called: true,
      };
    }
    case 'failure': {
      return {
        data: state.data,
        isLoading: false,
        error: action.error,
        called: true,
      };
    }
    case 'done': {
      if (state.isLoading) {
        return {
          data: state.data,
          isLoading: false,
          called: true,
        };
      }
      return state;
    }
  }
}

function InitUseTransactionQueryReducer<
  TData,
  TVariables extends Record<string, unknown> | undefined
>({
  skip,
  fetchPolicy,
}: UseTransactionQueryOptions<TVariables>): UseTransactionQueryState<TData> {
  let willFetchOnStart: boolean;
  switch (fetchPolicy) {
    case 'network-only':
    case 'no-cache': {
      willFetchOnStart = true;
      break;
    }

    case 'cache-only': {
      willFetchOnStart = false;
      break;
    }

    default: {
      willFetchOnStart = true;
      break;
    }
  }
  return {
    data: undefined,
    isLoading: skip ? false : willFetchOnStart,
    called: false,
  };
}

type FetchPolicy =
  | 'cache-and-network'
  | 'cache-first'
  | 'cache-only'
  | 'network-only'
  | 'no-cache';

export type UseTransactionQueryOptions<
  Variables extends Record<string, unknown> | undefined
> = {
  fetchPolicy?: FetchPolicy;
  skip?: boolean;
  pollInterval?: number;
  notifyOnNetworkStatusChange?: boolean;
  variables?: Variables;
};

export function createUseTransactionQuery<
  GeneratedSchema extends {
    query: object;
    mutation: object;
    subscription: object;
  }
>(client: ReturnType<typeof createClient>, _opts: CreateReactClientOptions) {
  const { resolved } = client;
  const clientQuery: GeneratedSchema['query'] = client.query;

  return function useTransactionQuery<
    TData,
    TVariables extends Record<string, unknown> | undefined = undefined
  >(
    fn: (query: typeof clientQuery, variables: TVariables) => TData,
    opts: UseTransactionQueryOptions<TVariables> = {}
  ) {
    opts.notifyOnNetworkStatusChange ??= true;

    const optsRef = useRef(opts);
    optsRef.current = opts;

    const { skip, pollInterval = 0, fetchPolicy, variables } = opts;

    const resolveOptions = useMemo<ResolveOptions>(() => {
      switch (fetchPolicy) {
        case 'no-cache': {
          return {
            noCache: true,
          };
        }
        case 'network-only': {
          return {
            refetch: true,
          };
        }
        case 'cache-and-network': {
          // TODO
          return {};
        }
        case 'cache-first': {
          // TODO
          return {};
        }
        case 'cache-only': {
          // TODO
          return {};
        }

        default: {
          // TODO
          return {};
        }
      }
    }, []);

    const [state, dispatchReducer] = useReducer(
      UseTransactionQueryReducer,
      opts,
      InitUseTransactionQueryReducer
    ) as [
      UseTransactionQueryState<TData>,
      Dispatch<UseTransactionQueryReducerAction<TData>>
    ];
    const dispatch = useBatchDispatch(dispatchReducer);

    const stateRef = useRef(state);
    stateRef.current = state;

    const fnRef = useRef(fn);
    fnRef.current = fn;

    const isFetching = useRef(false);

    const isFirstMount = useIsFirstMount();

    const queryCallback = useCallback(
      (resolveOpts: ResolveOptions = resolveOptions) => {
        if (skip)
          return dispatch({
            type: 'done',
          });

        stateRef.current.called = true;
        isFetching.current = true;
        dispatch({
          type: 'loading',
        });
        stateRef.current.isLoading = true;

        resolved<TData>(
          () => fnRef.current(clientQuery, optsRef.current.variables!),
          resolveOpts
        ).then(
          (data) => {
            isFetching.current = false;
            dispatch({
              type: 'success',
              data,
            });
            stateRef.current.data = data;
            stateRef.current.isLoading = false;
          },
          (err: unknown) => {
            isFetching.current = false;
            const error = gqlessError.create(err);
            dispatch({
              type: 'failure',
              error,
            });
            stateRef.current.error = error;
            stateRef.current.isLoading = false;
          }
        );
      },
      [stateRef, skip, resolveOptions, fnRef, dispatch]
    );

    if (IS_BROWSER && isFirstMount.current) {
      queryCallback();
    }

    const serializedVariables = useMemo(() => {
      return variables ? JSON.stringify(variables) : '';
    }, [variables]);

    useEffect(() => {
      if (!skip && !isFirstMount.current) {
        queryCallback();
      }
    }, [skip, queryCallback, serializedVariables]);

    useEffect(() => {
      if (skip || pollInterval <= 0) return;

      const interval = setInterval(() => {
        if (isFetching.current) return;

        isFetching.current = true;

        if (optsRef.current.notifyOnNetworkStatusChange)
          dispatch({
            type: 'loading',
          });

        resolved<TData>(
          () => fnRef.current(clientQuery, optsRef.current.variables!),
          {
            ...resolveOptions,
            refetch: true,
          }
        ).then(
          (data) => {
            isFetching.current = false;
            dispatch({
              type: 'success',
              data,
            });
          },
          (err) => {
            isFetching.current = false;

            dispatch({
              type: 'failure',
              error: gqlessError.create(err),
            });
          }
        );
      }, pollInterval);

      return () => {
        clearInterval(interval);
      };
    }, [
      pollInterval,
      skip,
      resolveOptions,
      optsRef,
      fnRef,
      dispatch,
      isFetching,
    ]);

    return state;
  };
}
