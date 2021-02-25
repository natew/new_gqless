import {
  MutableRefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from 'react';

import { BuildSelectionInput, ResolveOptions, Selection } from '@dish/gqless';
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

export const useForceUpdate = () => {
  const [, update] = useReducer(updateReducer, 0);

  return update;
};

const InitSymbol: any = Symbol();

export const useLazyRef = <T>(initialValFunc: () => T) => {
  const ref: MutableRefObject<T> = useRef(InitSymbol);
  if (ref.current === InitSymbol) {
    ref.current = initialValFunc();
  }
  return ref;
};

export const useIsFirstMount = () => {
  const isFirstMount = useRef(true);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
    }
  }, [isFirstMount]);

  return isFirstMount;
};

export const useUpdateEffect: typeof useEffect = (effect, deps) => {
  const isFirstMount = useIsFirstMount();

  useEffect(() => {
    if (!isFirstMount) return effect();
  }, deps);
};

export const useIsRendering = () => {
  const isRendering = useRef(true);
  isRendering.current = true;

  useEffect(() => {
    isRendering.current = false;
  });

  return isRendering;
};

export const useDeferDispatch = <F extends (...args: any[]) => void>(
  dispatchFn: F
) => {
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
    };
  }, []);
  const isRendering = useIsRendering();

  const pendingDispatch = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (pendingDispatch.current) {
      pendingDispatch.current();
      pendingDispatch.current = null;
    }
  });

  return useCallback(
    (...args: any[]) => {
      if (isRendering.current) {
        pendingDispatch.current = () => {
          if (isMounted.current) dispatchFn(...args);
        };
      } else if (isMounted.current) {
        dispatchFn(...args);
      }
    },
    [dispatchFn, isRendering, pendingDispatch, isMounted]
  ) as F;
};

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
  useIsomorphicLayoutEffect(() => {
    if (!shouldSubscribe) return;

    let isMounted = true;
    const unsubscribeFetch = eventHandler.onFetchSubscribe(
      (fetchPromise, promiseSelections) => {
        if (
          !promiseSelections.some((selection) => hookSelections.has(selection))
        )
          return;

        fetchPromise.then(
          () => {
            if (isMounted) onChange();
          },
          () => {}
        );
      }
    );

    const unsubscribeCache = eventHandler.onCacheChangeSubscribe(
      ({ selection }) => {
        if (isMounted && hookSelections.has(selection)) {
          onChange();
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
  interceptorManager,
  staleWhileRevalidate,
  scheduler,
  eventHandler,
}: {
  staleWhileRevalidate: boolean | undefined;
  interceptorManager: InterceptorManager;
  scheduler: Scheduler;
  eventHandler: EventHandler;
}) {
  const hookSelections = useSelectionsState();
  const forceUpdate = useDeferDispatch(useForceUpdate());
  const fetchingPromise = useRef<Promise<void> | null>(null);

  const interceptor = interceptorManager.createInterceptor();

  const isFirstMount = useIsFirstMount();

  if (staleWhileRevalidate && isFirstMount.current) {
    interceptor.selectionCacheRefetchListeners.add((selection) => {
      interceptorManager.globalInterceptor.addSelectionCacheRefetch(selection);

      hookSelections.add(selection);
    });
  }

  interceptor.selectionAddListeners.add((selection) => {
    hookSelections.add(selection);
  });

  interceptor.selectionCacheListeners.add((selection) => {
    hookSelections.add(selection);
  });

  const unsubscribeResolve = scheduler.subscribeResolve(
    (promise, selection) => {
      if (fetchingPromise.current === null && hookSelections.has(selection)) {
        fetchingPromise.current = new Promise<void>((resolve, reject) => {
          promise.then(
            () => {
              fetchingPromise.current = null;
              forceUpdate();
              resolve();
            },
            (err: unknown) => {
              fetchingPromise.current = null;
              reject(err);
            }
          );
        });
        forceUpdate();
      }
    }
  );

  function unsubscribe() {
    unsubscribeResolve();
    interceptorManager.removeInterceptor(interceptor);
  }

  setTimeout(unsubscribe, 0);

  useSubscribeCacheChanges({
    hookSelections,
    eventHandler,
    onChange: forceUpdate,
  });

  return { fetchingPromise, unsubscribe };
}
