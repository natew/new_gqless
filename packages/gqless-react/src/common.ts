import { useEffect, useLayoutEffect } from 'react';

export const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

import { useReducer } from 'react';

const updateReducer = (num: number): number => (num + 1) % 1_000_000;

export const useUpdate = () => {
  const [, update] = useReducer(updateReducer, 0);
  return update as () => void;
};
