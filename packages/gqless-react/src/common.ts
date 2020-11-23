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
  const isMounted = useRef(true);

  const isRendering = useRef(true);
  isRendering.current = true;

  const [, update] = useReducer(updateReducer, 0);

  useIsomorphicLayoutEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, [isMounted]);

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
