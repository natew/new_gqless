import {
  MutableRefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';

import {
  BuildSelectionInput,
  gqlessError,
  ResolveOptions,
  Selection,
} from '@dish/gqless';
import { EventHandler } from '@dish/gqless/dist/Events';
import { InterceptorManager } from '@dish/gqless/dist/Interceptor';
import { Scheduler } from '@dish/gqless/dist/Scheduler';

export function useOnFirstMount(fn: () => void) {
  const isFirstMount = useRef(true);
  if (isFirstMount.current) {
    isFirstMount.current = false;
    fn();
  }
}

export const IS_BROWSER = typeof window !== 'undefined';

export const useIsomorphicLayoutEffect = IS_BROWSER
  ? useLayoutEffect
  : useEffect;

const updateReducer = (num: number): number => (num + 1) % 1_000_000;

export function useForceUpdate() {
  const [, update] = useReducer(updateReducer, 0);

  const wasCalled = useRef(false);

  useEffect(() => {
    wasCalled.current = false;
  });

  return useMemo(() => {
    return Object.assign(
      () => {
        if (wasCalled.current) return;
        wasCalled.current = true;
        update();
      },
      {
        wasCalled,
      }
    );
  }, [update, wasCalled]);
}

const InitSymbol: any = Symbol();

export function useLazyRef<T>(initialValFunc: () => T) {
  const ref: MutableRefObject<T> = useRef(InitSymbol);
  if (ref.current === InitSymbol) {
    ref.current = initialValFunc();
  }
  return ref;
}

export const useUpdateEffect: typeof useEffect = (effect, deps) => {
  const firstEffectCall = useRef(true);

  useEffect(() => {
    if (firstEffectCall.current) {
      firstEffectCall.current = false;
    } else return effect();
  }, deps);
};

export function useIsRendering() {
  const isRendering = useRef(true);
  isRendering.current = true;

  useIsomorphicLayoutEffect(() => {
    isRendering.current = false;
  });

  return isRendering;
}

export function useIsMounted() {
  const isMounted = useRef(true);

  useIsomorphicLayoutEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
    };
  }, []);

  return isMounted;
}

export function useDeferDispatch<F extends (...args: any[]) => void>(
  dispatchFn: F
) {
  const isMounted = useIsMounted();
  const isRendering = useIsRendering();

  const pendingDispatch = useRef<Array<() => void> | false>(false);

  useEffect(() => {
    if (pendingDispatch.current) {
      for (const fn of pendingDispatch.current) {
        fn();
      }
      pendingDispatch.current = false;
    }
  });

  return useCallback(
    (...args: any[]) => {
      if (isRendering.current) {
        if (pendingDispatch.current) {
          pendingDispatch.current.push(() => {
            if (isMounted.current) dispatchFn(...args);
          });
        }
        pendingDispatch.current = [
          () => {
            if (isMounted.current) dispatchFn(...args);
          },
        ];
      } else if (isMounted.current) {
        dispatchFn(...args);
      }
    },
    [dispatchFn, isRendering, pendingDispatch, isMounted]
  ) as F;
}

export type FetchPolicy =
  | 'cache-and-network'
  | 'cache-first'
  | 'network-only'
  | 'no-cache';

const noCacheResolveOptions: ResolveOptions<unknown> = {
  noCache: true,
};

const refetchResolveOptions: ResolveOptions<unknown> = {
  refetch: true,
};

const emptyResolveOptions: ResolveOptions<unknown> = {};

export function fetchPolicyDefaultResolveOptions(
  fetchPolicy: FetchPolicy | undefined
): ResolveOptions<unknown> {
  switch (fetchPolicy) {
    case 'no-cache': {
      return noCacheResolveOptions;
    }
    case 'cache-and-network':
    case 'network-only': {
      return refetchResolveOptions;
    }
    case 'cache-first':
    default: {
      return emptyResolveOptions;
    }
  }
}

export type BuildSelections = (Selection | BuildSelectionInput)[];

export function useBuildSelections(
  argSelections: BuildSelections | null | undefined,
  buildSelection: (...args: BuildSelectionInput) => Selection,
  caller: Function
) {
  const buildSelections = useCallback(
    (selectionsSet: Set<Selection>) => {
      selectionsSet.clear();

      if (!argSelections) return;

      try {
        for (const filterValue of argSelections) {
          if (filterValue instanceof Selection) {
            selectionsSet.add(filterValue);
          } else {
            selectionsSet.add(buildSelection(...filterValue));
          }
        }
      } catch (err) {
        if (err instanceof Error && Error.captureStackTrace!) {
          Error.captureStackTrace(err, caller);
        }

        throw err;
      }
    },
    [argSelections]
  );

  const [selections] = useState(() => {
    const selectionsSet = new Set<Selection>();

    buildSelections(selectionsSet);

    return selectionsSet;
  });

  useUpdateEffect(() => {
    buildSelections(selections);
  }, [buildSelections, selections]);

  return {
    selections,
    hasSpecifiedSelections: argSelections != null,
  };
}

export type List<T> = Set<T> | Array<T>;

export function toSetIfNeeded<T>(list: List<T>): Set<T> {
  return Array.isArray(list) ? new Set(list) : list;
}

export function isSelectionIncluded(
  selection: Selection,
  selectionList: List<Selection>
) {
  const setSelectionList = toSetIfNeeded(selectionList);

  if (setSelectionList.has(selection)) return true;

  for (const listValue of selectionList) {
    if (setSelectionList.has(listValue)) return true;
  }

  return false;
}

export function isAnySelectionIncluded(
  selectionsToCheck: List<Selection>,
  selectionsList: List<Selection>
) {
  const setSelectionList = toSetIfNeeded(selectionsList);
  for (const selection of selectionsToCheck) {
    if (isSelectionIncluded(selection, setSelectionList)) return true;
  }

  return false;
}

export function isAnySelectionIncludedInMatrix(
  selectionsToCheck: List<Selection>,
  selectionsMatrix: List<List<Selection>>
) {
  const selectionsToCheckSet = toSetIfNeeded(selectionsToCheck);

  for (const group of selectionsMatrix) {
    if (isAnySelectionIncluded(selectionsToCheckSet, group)) return true;
  }

  return false;
}

function initSelectionsState() {
  return new Set<Selection>();
}

export function useSelectionsState() {
  const [selections] = useState(initSelectionsState);

  return selections;
}

export function useSubscribeCacheChanges({
  hookSelections,
  eventHandler,
  onChange,
  shouldSubscribe = true,
}: {
  hookSelections: Set<Selection>;
  eventHandler: EventHandler;
  onChange: () => void;
  shouldSubscribe?: boolean;
}) {
  const onChangeCalled = useRef(false);
  useIsomorphicLayoutEffect(() => {
    onChangeCalled.current = false;
  });

  useIsomorphicLayoutEffect(() => {
    if (!shouldSubscribe) return;

    let isMounted = true;
    const unsubscribeFetch = eventHandler.onFetchSubscribe(
      (fetchPromise, promiseSelections) => {
        if (
          onChangeCalled.current ||
          !promiseSelections.some((selection) => hookSelections.has(selection))
        ) {
          return;
        }

        onChangeCalled.current = true;
        fetchPromise.then(
          () => {
            if (isMounted) Promise.resolve(fetchPromise).then(onChange);
          },
          () => {}
        );
      }
    );

    const unsubscribeCache = eventHandler.onCacheChangeSubscribe(
      ({ selection }) => {
        if (
          isMounted &&
          !onChangeCalled.current &&
          hookSelections.has(selection)
        ) {
          onChangeCalled.current = true;
          Promise.resolve().then(onChange);
        }
      }
    );

    return () => {
      isMounted = false;
      unsubscribeFetch();
      unsubscribeCache();
    };
  }, [shouldSubscribe, hookSelections, eventHandler, onChange]);
}

export function useInterceptSelections({
  interceptorManager: {
    globalInterceptor,
    createInterceptor,
    removeInterceptor,
  },
  staleWhileRevalidate = false,
  scheduler,
  eventHandler,
  onError,
}: {
  staleWhileRevalidate: boolean | object | number | string | undefined | null;
  interceptorManager: InterceptorManager;
  scheduler: Scheduler;
  eventHandler: EventHandler;
  onError: OnErrorHandler | undefined;
}) {
  const hookSelections = useSelectionsState();
  const forceUpdate = useDeferDispatch(useForceUpdate());
  const fetchingPromise = useRef<Promise<void> | null>(null);

  const interceptor = createInterceptor();

  const enabledStaleWhileRevalidate =
    typeof staleWhileRevalidate === 'boolean'
      ? staleWhileRevalidate
      : staleWhileRevalidate != null;
  const cacheRefetchSelections = enabledStaleWhileRevalidate
    ? new Set<Selection>()
    : null;

  interceptor.selectionCacheRefetchListeners.add((selection) => {
    if (cacheRefetchSelections) cacheRefetchSelections.add(selection);

    hookSelections.add(selection);
  });

  useIsomorphicLayoutEffect(() => {
    if (enabledStaleWhileRevalidate && cacheRefetchSelections?.size) {
      for (const selection of cacheRefetchSelections) {
        globalInterceptor.addSelectionCacheRefetch(selection);
      }
    }
  }, [staleWhileRevalidate, enabledStaleWhileRevalidate]);

  interceptor.selectionAddListeners.add((selection) => {
    hookSelections.add(selection);
  });

  interceptor.selectionCacheListeners.add((selection) => {
    hookSelections.add(selection);
  });

  const deferredCall = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (deferredCall.current) {
      deferredCall.current();
      deferredCall.current = null;
    }
  });

  const isRendering = useIsRendering();

  const unsubscribeResolve = scheduler.subscribeResolve(
    (promise, selection) => {
      if (
        fetchingPromise.current === null &&
        deferredCall.current === null &&
        hookSelections.has(selection)
      ) {
        const newPromise = new Promise<void>((resolve) => {
          promise.then(({ error }) => {
            fetchingPromise.current = null;
            forceUpdate();
            if (error && onError) onError(error);

            resolve();
          });
        });
        if (staleWhileRevalidate && isRendering.current) {
          deferredCall.current = () => {
            fetchingPromise.current = newPromise;
            forceUpdate();
          };
        } else {
          deferredCall.current = null;
          fetchingPromise.current = newPromise;
          forceUpdate();
        }
      }
    }
  );

  function unsubscribe() {
    unsubscribeResolve();
    removeInterceptor(interceptor);
  }

  Promise.resolve().then(unsubscribe);

  useSubscribeCacheChanges({
    hookSelections,
    eventHandler,
    onChange: forceUpdate,
  });

  return { fetchingPromise, unsubscribe };
}

export function useSuspensePromise(optsRef: {
  current: { suspense?: boolean };
}) {
  const [promise, setPromiseState] = useState<Promise<unknown> | void>();

  const isMounted = useIsMounted();

  const setPromise = useCallback<(promise: Promise<unknown>) => void>(
    (newPromise) => {
      if (promise || !optsRef.current.suspense || !isMounted.current) return;

      function clearPromise() {
        if (isMounted.current) setPromiseState();
      }

      setPromiseState(newPromise.then(clearPromise, clearPromise));
    },
    [setPromiseState, optsRef]
  );

  if (promise) throw promise;

  return setPromise;
}

export type OnErrorHandler = (error: gqlessError) => void;
