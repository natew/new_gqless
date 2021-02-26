import {
  Dispatch,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';

import {
  createClient,
  doRetry,
  gqlessError,
  ResolveOptions,
  RetryOptions,
} from '@dish/gqless';

import {
  FetchPolicy,
  fetchPolicyDefaultResolveOptions,
  useDeferDispatch,
  useSelectionsState,
  useSubscribeCacheChanges,
} from '../common';
import { ReactClientOptionsWithDefaults } from '../utils';

export interface UseTransactionQueryState<TData> {
  data: TData | undefined;
  error?: gqlessError;
  isLoading: boolean;
  isCalled: boolean;
}

type UseTransactionQueryReducerAction<TData> =
  | { type: 'cache-found'; data: TData }
  | { type: 'success'; data: TData }
  | { type: 'failure'; error: gqlessError }
  | { type: 'loading' }
  | {
      type: 'done';
    };

function UseTransactionQueryReducer<TData>(
  state: UseTransactionQueryState<TData>,
  action: UseTransactionQueryReducerAction<TData>
): UseTransactionQueryState<TData> {
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
    case 'cache-found': {
      return {
        data: action.data,
        isLoading: state.isLoading,
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
    case 'done': {
      if (state.isLoading) {
        return {
          data: state.data,
          isLoading: false,
          isCalled: true,
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
}: UseTransactionQueryOptions<
  TData,
  TVariables
>): UseTransactionQueryState<TData> {
  return {
    data: undefined,
    isLoading: skip ? false : true,
    isCalled: false,
  };
}

export interface UseTransactionQueryOptions<
  TData,
  Variables extends Record<string, unknown> | undefined
> {
  fetchPolicy?: FetchPolicy;
  skip?: boolean;
  pollInterval?: number;
  notifyOnNetworkStatusChange?: boolean;
  variables?: Variables;
  onCompleted?: (data: TData) => void;
  onError?: (error: gqlessError) => void;
  retry?: RetryOptions;
}

export interface UseTransactionQuery<
  GeneratedSchema extends {
    query: object;
  }
> {
  <TData, TVariables extends Record<string, unknown> | undefined = undefined>(
    fn: (query: GeneratedSchema['query'], variables: TVariables) => TData,
    options?: UseTransactionQueryOptions<TData, TVariables>
  ): UseTransactionQueryState<TData>;
}

export function createUseTransactionQuery<
  GeneratedSchema extends {
    query: object;
  }
>(
  client: ReturnType<typeof createClient>,
  {
    defaults: { fetchPolicy: defaultFetchPolicy, retry: defaultRetry },
  }: ReactClientOptionsWithDefaults
) {
  const { resolved, eventHandler } = client;
  const clientQuery: GeneratedSchema['query'] = client.query;

  const useTransactionQuery: UseTransactionQuery<GeneratedSchema> = function useTransactionQuery<
    TData,
    TVariables extends Record<string, unknown> | undefined = undefined
  >(
    fn: (query: typeof clientQuery, variables: TVariables) => TData,
    queryOptions?: UseTransactionQueryOptions<TData, TVariables>
  ) {
    const opts = Object.assign({}, queryOptions);

    opts.fetchPolicy ??= defaultFetchPolicy;
    opts.retry ??= defaultRetry;

    opts.notifyOnNetworkStatusChange ??= true;

    const optsRef = useRef(opts);
    optsRef.current = opts;

    const { skip, pollInterval = 0, fetchPolicy, variables } = opts;

    const hookSelections = useSelectionsState();

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

    const queryCallback = useCallback(
      (
        resolveOpts: ResolveOptions<TData> = resolveOptions,
        fetchPolicyArg: FetchPolicy | undefined = fetchPolicy
      ) => {
        if (skip) {
          return Promise.resolve(
            dispatch({
              type: 'done',
            })
          );
        }

        stateRef.current.isCalled = true;
        isFetching.current = true;
        dispatch({
          type: 'loading',
        });
        stateRef.current.isLoading = true;

        const fn = () => fnRef.current(clientQuery, optsRef.current.variables!);

        return resolved<TData>(fn, {
          ...resolveOpts,
          onSelection(selection) {
            hookSelections.add(selection);
          },
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
                return false;
            }
          },
        }).then(
          (data) => {
            optsRef.current.onCompleted?.(data);
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
            const error = gqlessError.create(err, useTransactionQuery);
            optsRef.current.onError?.(error);
            dispatch({
              type: 'failure',
              error,
            });
            stateRef.current.error = error;
            stateRef.current.isLoading = false;

            return error;
          }
        );
      },
      [fetchPolicy, skip, stateRef, resolveOptions, fnRef, dispatch]
    );

    const serializedVariables = useMemo(() => {
      return variables ? JSON.stringify(variables) : '';
    }, [variables]);

    useEffect(() => {
      if (!skip) {
        queryCallback().then((result) => {
          if (result instanceof gqlessError && optsRef.current.retry) {
            doRetry(optsRef.current.retry, {
              async onRetry() {
                const result = await queryCallback();
                if (result instanceof gqlessError) {
                  throw result;
                }
              },
            });
          }
        });
      }
    }, [skip, queryCallback, serializedVariables, optsRef]);

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
                error: gqlessError.create(err, useTransactionQuery),
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

    const isChanging = useRef(false);

    useSubscribeCacheChanges({
      hookSelections,
      eventHandler,
      shouldSubscribe: fetchPolicy !== 'no-cache',
      onChange: () => {
        if (isChanging.current) return;
        isChanging.current = true;

        queryCallback(
          {
            refetch: false,
          },
          'cache-first'
        ).finally(() => (isChanging.current = false));
      },
    });

    return state;
  };

  return useTransactionQuery;
}
