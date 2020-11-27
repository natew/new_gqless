import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';

import {
  createClient,
  gqlessError,
  Selection,
  SelectionType,
} from '@dish/gqless';

import { CreateReactClientOptions } from '../client';
import { useLazyRef } from '../common';

function initSelectionsState() {
  return new Set<Selection>();
}

interface UseRefetchReducerState {
  isLoading: boolean;
  error?: gqlessError;
}

type UseRefetchReducerAction =
  | {
      type: 'loading';
    }
  | {
      type: 'done';
    }
  | {
      type: 'error';
      error: gqlessError;
    };

function UseRefetchReducer(
  state: UseRefetchReducerState,
  action: UseRefetchReducerAction
): UseRefetchReducerState {
  switch (action.type) {
    case 'loading': {
      if (state.isLoading) return state;
      return {
        isLoading: true,
      };
    }
    case 'done': {
      return {
        isLoading: false,
      };
    }
    case 'error': {
      return {
        isLoading: false,
        error: action.error,
      };
    }
  }
}

function InitUseRefetchReducer(): UseRefetchReducerState {
  return {
    isLoading: false,
  };
}

export interface UseRefetchState extends UseRefetchReducerState {
  startWatching: () => void;
  stopWatching: () => void;
}

export interface UseRefetchOptions {
  notifyOnNetworkStatusChange?: boolean;
  startWatching?: boolean;
}

export function createUseRefetch(
  client: ReturnType<typeof createClient>,
  _opts: CreateReactClientOptions
) {
  const { interceptorManager, buildAndFetchSelections } = client;

  function initInnerState() {
    return {
      watching: true,
    };
  }

  return function useRefetch(refetchOptions?: UseRefetchOptions) {
    const opts = Object.assign({}, refetchOptions);
    opts.notifyOnNetworkStatusChange ??= true;
    opts.startWatching ??= true;

    const optsRef = useRef(opts);
    optsRef.current = opts;

    const innerState = useLazyRef(initInnerState);
    innerState.current.watching = opts.startWatching;

    const startWatching = useCallback(() => {
      innerState.current.watching = true;
    }, [innerState]);

    const stopWatching = useCallback(() => {
      innerState.current.watching = false;
    }, [innerState]);

    const [selections] = useState(initSelectionsState);
    const [reducerState, dispatch] = useReducer(
      UseRefetchReducer,
      undefined,
      InitUseRefetchReducer
    );

    const interceptor = interceptorManager.createInterceptor();

    interceptor.selectionAddListeners.add((selection) => {
      if (!innerState.current.watching) return;

      selections.add(selection);
    });

    useEffect(() => {
      interceptorManager.removeInterceptor(interceptor);
    });

    const refetch = useCallback(async () => {
      const selectionsToRefetch = Array.from(selections).filter(
        (v) => v.type === SelectionType.Query
      );
      if (selectionsToRefetch.length === 0) {
        if (process.env.NODE_ENV !== 'production')
          console.warn('Warning! No selections available to refetch!');
        return;
      }

      if (optsRef.current.notifyOnNetworkStatusChange)
        dispatch({
          type: 'loading',
        });

      try {
        await buildAndFetchSelections(selectionsToRefetch, 'query');
        dispatch({
          type: 'done',
        });
      } catch (err) {
        const error = gqlessError.create(err);
        dispatch({
          type: 'error',
          error,
        });
        throw error;
      }
    }, [selections, dispatch, optsRef]);

    const state: UseRefetchState = useMemo(
      () =>
        Object.assign(reducerState, {
          startWatching,
          stopWatching,
        }),
      [reducerState, startWatching, stopWatching]
    );

    return useMemo(() => Object.assign(refetch.bind(undefined), state), [
      refetch,
      state,
    ]);
  };
}
