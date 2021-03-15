import type { createClient, gqlessError } from '@dish/gqless';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  BuildSelections,
  isAnySelectionIncluded,
  isAnySelectionIncludedInMatrix,
  isSelectionIncluded,
  OnErrorHandler,
  useBuildSelections,
  useIsomorphicLayoutEffect,
} from '../common';
import { areArraysEqual } from '../utils';

export interface UseGqlessStateOptions {
  onIsFetching?: () => void;
  onDoneFetching?: () => void;
  onNewError?: OnErrorHandler;
  filterSelections?: BuildSelections;
}

export interface MetaState {
  isFetching: boolean;
  errors?: gqlessError[];
}

export function createUseMetaState(client: ReturnType<typeof createClient>) {
  const scheduler = client.scheduler;

  const { buildSelection } = client;

  const errorsMap = scheduler.errors.map;

  const defaultEmptyOpts = {};

  function useMetaState(opts: UseGqlessStateOptions = defaultEmptyOpts) {
    const {
      hasSpecifiedSelections: hasFilterSelections,
      selections: selectionsToFilter,
    } = useBuildSelections(opts.filterSelections, buildSelection, useMetaState);

    const [promisesInFly] = useState(() => {
      return new Set<Promise<unknown>>();
    });

    const isMountedRef = useRef(true);
    useEffect(() => {
      return () => {
        isMountedRef.current = false;
      };
    }, []);

    const getState = useCallback(
      (isMounted: { current: boolean } = isMountedRef): MetaState => {
        let isFetching: boolean;
        if (scheduler.pendingSelectionsGroups.size) {
          if (hasFilterSelections) {
            isFetching = isAnySelectionIncludedInMatrix(
              selectionsToFilter,
              scheduler.pendingSelectionsGroups
            );
          } else {
            isFetching = true;
          }

          if (isFetching && scheduler.pendingSelectionsGroupsPromises.size) {
            Promise.all(
              scheduler.pendingSelectionsGroupsPromises.values()
            ).finally(() => setStateIfChanged(isMounted));
          }
        } else {
          isFetching = false;
        }

        let errors: gqlessError[] | undefined;

        if (hasFilterSelections) {
          const errorsSet = new Set<gqlessError>();

          selectionsToFilter.forEach((selection) => {
            const error = errorsMap.get(selection);

            if (error) errorsSet.add(error);
          });

          if (errorsSet.size) errors = Array.from(errorsSet);
        } else if (errorsMap.size) {
          errors = Array.from(new Set(errorsMap.values()));
        }

        return errors ? { isFetching, errors } : { isFetching };
      },
      [hasFilterSelections, selectionsToFilter]
    );

    const setStateIfChanged = useCallback(
      function setStateIfChanged(isMounted: { current: boolean }) {
        if (!isMounted.current) return;

        const prevState = stateRef.current;

        const newState = getState(isMounted);

        if (
          prevState.isFetching !== newState.isFetching ||
          !areArraysEqual(prevState.errors, newState.errors)
        ) {
          stateRef.current = newState;
          setTimeout(() => {
            if (isMounted.current) setState(newState);
          }, 0);
        }
      },
      []
    );

    const [state, setState] = useState(getState);

    const stateRef = useRef(state);
    stateRef.current = state;

    const optsRef = useRef(opts);
    optsRef.current = opts;

    useIsomorphicLayoutEffect(() => {
      const isMounted = { current: true };

      const unsubscribeIsFetching = scheduler.subscribeResolve(
        (promise, selection) => {
          if (promisesInFly.has(promise)) return;

          if (
            hasFilterSelections &&
            !isSelectionIncluded(selection, selectionsToFilter)
          ) {
            return;
          }

          if (promisesInFly.size === 0) optsRef.current.onIsFetching?.();

          promisesInFly.add(promise);

          setStateIfChanged(isMounted);

          promise.then(() => {
            promisesInFly.delete(promise);

            if (promisesInFly.size === 0) optsRef.current.onDoneFetching?.();

            setStateIfChanged(isMounted);
          });
        }
      );

      const unsubscribeErrors = scheduler.errors.subscribeErrors((data) => {
        switch (data.type) {
          case 'new_error': {
            if (hasFilterSelections) {
              if (isAnySelectionIncluded(selectionsToFilter, data.selections))
                optsRef.current.onNewError?.(data.newError);
              else return;
            } else {
              optsRef.current.onNewError?.(data.newError);
            }
            break;
          }
          case 'retry': {
            if (hasFilterSelections) {
              if (isAnySelectionIncluded(selectionsToFilter, data.selections)) {
                data.retryPromise.finally(() => {
                  setTimeout(() => {
                    setStateIfChanged(isMounted);
                  }, 0);
                });
              }
            } else {
              data.retryPromise.finally(() => {
                setTimeout(() => {
                  setStateIfChanged(isMounted);
                }, 0);
              });
            }
            break;
          }
        }

        setStateIfChanged(isMounted);
      });

      return () => {
        isMounted.current = false;
        unsubscribeIsFetching();
        unsubscribeErrors();
      };
    }, [getState, hasFilterSelections, setState, optsRef, selectionsToFilter]);

    return state;
  }

  return useMetaState;
}
