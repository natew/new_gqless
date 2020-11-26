import { Dispatch, useEffect, useReducer, useRef } from 'react';

import { createClient, gqlessError, ResolveOptions } from '@dish/gqless';

import { CreateReactClientOptions } from '../client';
import { useIsMounted, useIsomorphicLayoutEffect } from '../common';

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

export interface UseTransactionQueryOptions extends ResolveOptions {
  skip?: boolean;
  pollInterval?: number;
  notifyOnNetworkStatusChange?: boolean;
}

export function createUseTransactionQuery<
  GeneratedSchema extends {
    query: object;
    mutation: object;
    subscription: object;
  }
>(client: ReturnType<typeof createClient>, _opts: CreateReactClientOptions) {
  const { resolved } = client;
  const clientQuery: GeneratedSchema['query'] = client.query;

  return function useTransactionQuery<A>(
    fn: (query: typeof clientQuery) => A,
    opts: UseTransactionQueryOptions = {}
  ) {
    const optsRef = useRef(opts);
    optsRef.current = opts;

    const { skip, noCache, refetch, pollInterval = 0 } = opts;

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

        if (isMounted.current && optsRef.current.notifyOnNetworkStatusChange)
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
    }, [pollInterval, skip, noCache, optsRef, fnRef, isMounted]);

    return state;
  };
}
