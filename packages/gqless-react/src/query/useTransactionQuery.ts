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
import {
  FetchPolicy,
  fetchPolicyDefaultResolveOptions,
  IS_BROWSER,
  useDeferDispatch,
  useIsFirstMount,
} from '../common';

export interface UseTransactionQueryState<A> {
  data: A | undefined;
  error?: gqlessError;
  isLoading: boolean;
  called: boolean;
}

type UseTransactionQueryReducerAction<A> =
  | { type: 'cache-found'; data: A }
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
    case 'cache-found': {
      return {
        data: action.data,
        isLoading: state.isLoading,
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
}: UseTransactionQueryOptions<TVariables>): UseTransactionQueryState<TData> {
  return {
    data: undefined,
    isLoading: skip ? false : true,
    called: false,
  };
}

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
>(
  client: ReturnType<typeof createClient>,
  clientOpts: CreateReactClientOptions
) {
  const { resolved } = client;
  const clientQuery: GeneratedSchema['query'] = client.query;

  return function useTransactionQuery<
    TData,
    TVariables extends Record<string, unknown> | undefined = undefined
  >(
    fn: (query: typeof clientQuery, variables: TVariables) => TData,
    queryOptions?: UseTransactionQueryOptions<TVariables>
  ) {
    const opts = Object.assign({}, queryOptions);

    opts.fetchPolicy ??= clientOpts.defaultFetchPolicy || 'cache-first';

    opts.notifyOnNetworkStatusChange ??= true;

    const optsRef = useRef(opts);
    optsRef.current = opts;

    const { skip, pollInterval = 0, fetchPolicy, variables } = opts;

    const resolveOptions = useMemo<ResolveOptions<TData>>(() => {
      return fetchPolicyDefaultResolveOptions(fetchPolicy);
    }, [fetchPolicy]);

    const [state, dispatchReducer] = useReducer(
      UseTransactionQueryReducer,
      opts,
      InitUseTransactionQueryReducer
    ) as [
      UseTransactionQueryState<TData>,
      Dispatch<UseTransactionQueryReducerAction<TData>>
    ];
    const dispatch = useDeferDispatch(dispatchReducer);

    const stateRef = useRef(state);
    stateRef.current = state;

    const fnRef = useRef(fn);
    fnRef.current = fn;

    const isFetching = useRef(false);

    const isFirstMount = useIsFirstMount();

    const queryCallback = useCallback(
      (
        resolveOpts: ResolveOptions<TData> = resolveOptions,
        fetchPolicyArg: FetchPolicy | undefined = fetchPolicy
      ) => {
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
          {
            ...resolveOpts,
            onCacheData(data): boolean {
              switch (fetchPolicyArg) {
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
          }
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
      [fetchPolicy, skip, stateRef, resolveOptions, fnRef, dispatch]
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

      let isMounted = true;

      const interval = setInterval(() => {
        if (isFetching.current) return;

        isFetching.current = true;

        if (isMounted && optsRef.current.notifyOnNetworkStatusChange)
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
            if (isMounted)
              dispatch({
                type: 'success',
                data,
              });
          },
          (err) => {
            isFetching.current = false;

            if (isMounted)
              dispatch({
                type: 'failure',
                error: gqlessError.create(err),
              });
          }
        );
      }, pollInterval);

      return () => {
        isMounted = false;
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
