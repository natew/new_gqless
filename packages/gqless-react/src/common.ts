import { ResolveOptions } from '@dish/gqless';
import {
  MutableRefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
} from 'react';

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
          dispatchFn(...args);
        };
      } else {
        dispatchFn(...args);
      }
    },
    [dispatchFn, isRendering, pendingDispatch]
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
