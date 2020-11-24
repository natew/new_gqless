import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
} from 'react';

export const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const updateReducer = (num: number): number => (num + 1) % 1_000_000;

export const useBatchUpdate = () => {
  const isMounted = useIsMounted();

  const isRendering = useRef(true);
  isRendering.current = true;

  const [, update] = useReducer(updateReducer, 0);

  useEffect(() => {
    isRendering.current = false;
  });

  return useCallback(() => {
    if (!isMounted.current) return;

    if (isRendering.current) {
      setTimeout(() => {
        update();
      }, 0);
    } else {
      update();
    }
  }, [update, isRendering, isMounted]);
};

export const useIsMounted = () => {
  const isMounted = useRef(true);

  useIsomorphicLayoutEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  return isMounted;
};
