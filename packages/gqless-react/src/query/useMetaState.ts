import type { createClient, gqlessError } from '@dish/gqless';
import { useEffect, useRef, useState } from 'react';

export interface UseGqlessStateOptions {
  onIsFetching?: () => void;
  onDoneFetching?: () => void;
  onNewError?: (error: gqlessError) => void;
}

export function createUseMetaState(client: ReturnType<typeof createClient>) {
  const scheduler = client.scheduler;

  function getErrors() {
    const errorsMap = scheduler.errors.map;
    return errorsMap.size > 0
      ? Array.from(new Set(errorsMap.values()))
      : undefined;
  }

  const defaultEmptyOpts = {};

  function useMetaState(opts: UseGqlessStateOptions = defaultEmptyOpts) {
    const [state, setState] = useState<{
      isFetching: boolean;
      errors?: gqlessError[];
    }>(() => {
      const errors = getErrors();
      const isFetching = scheduler.isFetching;

      if (errors) {
        return {
          isFetching,
          errors,
        };
      }

      return {
        isFetching,
      };
    });

    const optsRef = useRef(opts);
    optsRef.current = opts;

    useEffect(() => {
      let isMounted = true;
      const unsubscribeIsFetching = scheduler.subscribeIsFetching(
        (isFetching) => {
          if (isFetching) optsRef.current.onIsFetching?.();
          else optsRef.current.onDoneFetching?.();

          if (!isMounted) return;

          setState((prevState) => {
            return { ...prevState, isFetching };
          });
        }
      );

      const unsubscribeErrors = scheduler.errors.subscribeErrors((data) => {
        if ('newError' in data) optsRef.current.onNewError?.(data.newError);

        if (!isMounted) return;

        setState((prevState) => {
          return { ...prevState, errors: getErrors() };
        });
      });

      return () => {
        isMounted = false;
        unsubscribeIsFetching();
        unsubscribeErrors();
      };
    }, [setState, optsRef]);

    return state;
  }

  return useMetaState;
}
