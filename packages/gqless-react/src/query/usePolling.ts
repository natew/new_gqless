import { Dispatch, useEffect, useMemo, useReducer, useRef } from 'react';

import { createClient, gqlessError, Poller } from '@dish/gqless';

import { CreateReactClientOptions } from '../client';
import { useBatchDispatch } from '../common';

export interface UsePollingState<A> {
  data: A | undefined;
  error?: gqlessError;
  isLoading: boolean;
}

type UsePollingReducerAction<A> =
  | { type: 'success'; data: A }
  | { type: 'failure'; error: gqlessError }
  | { type: 'loading' };

function UsePollingReducer<A>(
  state: UsePollingState<A>,
  action: UsePollingReducerAction<A>
): UsePollingState<A> {
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

function InitUsePollingReducer<A>(): UsePollingState<A> {
  return {
    data: undefined,
    isLoading: false,
  };
}

export interface UsePollingOptions {
  pollInterval: number;
  onError?: (err: gqlessError) => void;
  notifyOnNetworkStatusChange?: boolean;
  pause?: boolean;
}

export function createUsePolling(
  client: ReturnType<typeof createClient>,
  _opts: CreateReactClientOptions
) {
  return function usePolling<D>(
    fn: () => D,
    pollingOptions: UsePollingOptions
  ) {
    const opts = Object.assign({}, pollingOptions);
    opts.notifyOnNetworkStatusChange ??= false;

    const optsRef = useRef(opts);
    optsRef.current = opts;
    const { pollInterval, pause } = opts;

    const fnRef = useRef(fn);
    fnRef.current = fn;

    const [state, dispatchReducer] = useReducer(
      UsePollingReducer,
      undefined,
      InitUsePollingReducer
    ) as [UsePollingState<D>, Dispatch<UsePollingReducerAction<D>>];
    const dispatch = useBatchDispatch(dispatchReducer);

    const poller = useMemo(() => {
      return new Poller(fnRef, pollInterval, client);
    }, [fnRef]);

    useEffect(() => {
      return poller.subscribe((event) => {
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
  };
}
