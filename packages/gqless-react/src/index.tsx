import React, {
  Dispatch,
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';

import {
  useBatchUpdate,
  useIsMounted,
  useIsomorphicLayoutEffect,
} from './common';

import { gqlessError, Poller } from '@dish/gqless';
import type { createClient, ResolveOptions } from '@dish/gqless';

export interface UseTransactionQueryOptions extends ResolveOptions {
  skip?: boolean;
  pollInterval?: number;
  notifyOnNetworkStatusChange?: boolean;
}

export interface UseLazyQueryOptions extends ResolveOptions {}

export interface UseMutationOptions extends ResolveOptions {}

export interface UsePollingOptions {
  pollInterval: number;
  onError?: (err: gqlessError) => void;
  notifyOnNetworkStatusChange?: boolean;
  pause?: boolean;
}

export interface UseTransactionQueryState<A> {
  data: A | undefined;
  error?: gqlessError;
  isLoading: boolean;
}

type UseTransactionQueryReducerAction<A> =
  | { type: 'success'; data: A }
  | { type: 'failure'; error: gqlessError }
  | { type: 'loading' }
  | {
      type: 'done';
    };

export interface UseLazyQueryState<A> {
  data: A | undefined;
  error?: gqlessError;
  isLoading: boolean;
}

type UseLazyQueryReducerAction<A> =
  | { type: 'success'; data: A }
  | { type: 'failure'; error: gqlessError }
  | { type: 'loading' };

export interface UseMutationState<A> {
  data: A | undefined;
  error?: gqlessError;
  isLoading: boolean;
}

type UseMutationReducerAction<A> =
  | { type: 'success'; data: A }
  | { type: 'failure'; error: gqlessError }
  | { type: 'loading' };

export interface UsePollingState<A> {
  data: A | undefined;
  error?: gqlessError;
  isLoading: boolean;
}

type UsePollingReducerAction<A> =
  | { type: 'success'; data: A }
  | { type: 'failure'; error: gqlessError }
  | { type: 'loading' };

export function createReactClient<
  GeneratedSchema extends {
    query: object;
    mutation: object;
    subscription: object;
  } = never
>(
  client: ReturnType<typeof createClient>,
  { defaultSuspense = true }: { defaultSuspense?: boolean } = {}
) {
  const { resolved, scheduler } = client;
  const clientQuery: GeneratedSchema['query'] = client.query;
  const clientMutation: GeneratedSchema['mutation'] = client.mutation;

  function graphql<R extends ReactElement<any, any> | null, P = unknown>(
    component: (props: P) => R,
    { suspense = defaultSuspense }: { suspense?: boolean } = {}
  ) {
    const withGraphQL: {
      (props: P): R;
      displayName: string;
    } = function WithGraphQL(props) {
      let fetchingPromise = useRef<Promise<void>>();

      const forceUpdate = useBatchUpdate();

      const unsubscribe = scheduler.subscribeResolve((promise) => {
        fetchingPromise.current = new Promise<void>((resolve, reject) => {
          promise.then(
            () => {
              fetchingPromise.current = undefined;
              forceUpdate();
              resolve();
            },
            (err) => {
              fetchingPromise.current = undefined;
              reject(err);
            }
          );
        });

        forceUpdate();
      });

      useEffect(() => {
        return unsubscribe;
      });

      const returnValue: R = component(props);

      if (suspense && fetchingPromise.current) {
        const Suspend = () => {
          if (!fetchingPromise.current) return null;

          throw fetchingPromise.current;
        };
        return (
          <>
            {returnValue}
            <Suspend />
          </>
        ) as R;
      }
      return returnValue;
    };
    withGraphQL.displayName = `GraphQLComponent(${
      (component as any)?.displayName || (component as any)?.name || 'Anonymous'
    })`;

    return withGraphQL;
  }

  function useQuery({
    suspense = defaultSuspense,
  }: {
    suspense?: boolean;
  } = {}) {
    const fetchingPromise = useRef<Promise<void>>();
    const forceUpdate = useBatchUpdate();

    const unsubscribe = scheduler.subscribeResolve((promise) => {
      fetchingPromise.current = new Promise<void>((resolve, reject) => {
        promise.then(
          () => {
            fetchingPromise.current = undefined;
            forceUpdate();
            resolve();
          },
          (err) => {
            fetchingPromise.current = undefined;
            reject(err);
          }
        );
      });
      forceUpdate();
    });

    useEffect(() => {
      return unsubscribe;
    });

    if (suspense && fetchingPromise.current) {
      throw fetchingPromise.current;
    }

    return clientQuery;
  }

  function UseTransactionQueryReducer<A>(
    state: UseTransactionQueryState<A>,
    action: UseTransactionQueryReducerAction<A>
  ): UseTransactionQueryState<A> {
    switch (action.type) {
      case 'loading': {
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
      case 'done': {
        if (state.isLoading) {
          return {
            data: state.data,
            isLoading: false,
          };
        }
        return state;
      }
    }
  }

  function InitUseTransactionQueryReducer<A>({
    skip,
    refetch,
    noCache,
  }: UseTransactionQueryOptions): UseTransactionQueryState<A> {
    return {
      data: undefined,
      isLoading: skip ? false : refetch || noCache ? true : false,
    };
  }

  function useTransactionQuery<A>(
    fn: (query: typeof clientQuery) => A,
    opts: UseTransactionQueryOptions = {}
  ) {
    const {
      noCache,
      refetch,
      skip,
      pollInterval = 0,
      notifyOnNetworkStatusChange,
    } = opts;
    const [state, dispatch] = useReducer(
      UseTransactionQueryReducer,
      opts,
      InitUseTransactionQueryReducer
    ) as [
      UseTransactionQueryState<A>,
      Dispatch<UseTransactionQueryReducerAction<A>>
    ];

    const isMounted = useIsMounted();

    const fnRef = useRef(fn);
    fnRef.current = fn;

    const isFetching = useRef(false);

    useIsomorphicLayoutEffect(() => {
      if (skip)
        return dispatch({
          type: 'done',
        });

      isFetching.current = true;
      dispatch({
        type: 'loading',
      });
      resolved<A>(() => fnRef.current(clientQuery), {
        noCache,
        refetch,
      }).then(
        (data) => {
          isFetching.current = false;
          if (isMounted.current)
            dispatch({
              type: 'success',
              data,
            });
        },
        (error) => {
          isFetching.current = false;
          if (isMounted.current)
            dispatch({
              type: 'failure',
              error,
            });
        }
      );
    }, [skip, noCache, refetch, fnRef, dispatch]);

    useEffect(() => {
      if (skip || pollInterval <= 0) return;

      const interval = setInterval(() => {
        if (isFetching.current) return;

        isFetching.current = true;

        if (notifyOnNetworkStatusChange && isMounted.current)
          dispatch({
            type: 'loading',
          });

        resolved<A>(() => fnRef.current(clientQuery), {
          noCache,
          refetch: true,
        }).then(
          (data) => {
            isFetching.current = false;
            if (isMounted.current)
              dispatch({
                type: 'success',
                data,
              });
          },
          (err) => {
            isFetching.current = false;

            if (isMounted.current)
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
      noCache,
      notifyOnNetworkStatusChange,
      fnRef,
      isMounted,
    ]);

    return state;
  }

  function UseLazyQueryReducer<A>(
    state: UseLazyQueryState<A>,
    action: UseLazyQueryReducerAction<A>
  ): UseLazyQueryState<A> {
    switch (action.type) {
      case 'loading': {
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

  function useLazyQuery<A>(
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
  }

  function UseMutationReducer<A>(
    state: UseMutationState<A>,
    action: UseMutationReducerAction<A>
  ): UseMutationState<A> {
    switch (action.type) {
      case 'loading': {
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

  function useMutation<A>(
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
  }

  function UsePollingReducer<A>(
    state: UsePollingState<A>,
    action: UsePollingReducerAction<A>
  ): UsePollingState<A> {
    switch (action.type) {
      case 'loading': {
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

  function InitUsePollingReducer<A>(): UsePollingState<A> {
    return {
      data: undefined,
      isLoading: false,
    };
  }

  function usePolling<D>(fn: () => D, opts: UsePollingOptions) {
    const optsRef = useRef(opts);
    optsRef.current = opts;

    const { pollInterval, pause } = opts;
    const [state, dispatch] = useReducer(
      UsePollingReducer,
      undefined,
      InitUsePollingReducer
    ) as [UsePollingState<D>, Dispatch<UsePollingReducerAction<D>>];
    const fnRef = useRef(fn);
    fnRef.current = fn;

    const isMounted = useIsMounted();

    const poller = useMemo(() => {
      return new Poller(fnRef, pollInterval, client);
    }, [fnRef]);

    useEffect(() => {
      const unsubscribe = poller.subscribe((event) => {
        if (!isMounted.current) return;

        switch (event.type) {
          case 'fetching': {
            if (optsRef.current.notifyOnNetworkStatusChange) {
              dispatch({
                type: 'loading',
              });
            }
            break;
          }
          case 'data': {
            dispatch({
              type: 'success',
              data: event.data,
            });
            break;
          }
          case 'error': {
            const error = gqlessError.create(event.error);

            dispatch({
              type: 'failure',
              error,
            });

            if (optsRef.current.onError) {
              optsRef.current.onError(error);
            }
            break;
          }
        }
      });

      return () => {
        unsubscribe();
      };
    }, [poller, dispatch, optsRef]);

    useEffect(() => {
      poller.pollInterval = pollInterval;
    }, [poller, pollInterval]);

    useEffect(() => {
      if (pause) {
        poller.stop();
      } else {
        poller.start();
      }
    }, [poller, pause]);

    return state;
  }

  const state = new Proxy(
    {
      isLoading: false,
    },
    {
      get(target, key, receiver) {
        if (key === 'isLoading') {
          return Boolean(scheduler.resolving);
        }
        return Reflect.get(target, key, receiver);
      },
    }
  );

  return {
    useQuery,
    useLazyQuery,
    useTransactionQuery,
    useMutation,
    usePolling,
    graphql,
    state,
  };
}
