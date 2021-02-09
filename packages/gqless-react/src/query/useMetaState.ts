import type { createClient, gqlessError } from '@dish/gqless';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  BuildSelections,
  isAnySelectionIncluded,
  isAnySelectionIncludedInMatrix,
  isSelectionIncluded,
  useBuildSelections,
} from '../common';
import { areArraysEqual } from '../utils';

export interface UseGqlessStateOptions {
  onIsFetching?: () => void;
  onDoneFetching?: () => void;
  onNewError?: (error: gqlessError) => void;
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

    const getState = useCallback((): MetaState => {
      const isFetching =
        scheduler.pendingSelectionsGroups.size > 0
          ? hasFilterSelections
            ? isAnySelectionIncludedInMatrix(
                selectionsToFilter,
                scheduler.pendingSelectionsGroups
              )
            : true
          : false;

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
    }, [hasFilterSelections, selectionsToFilter]);

    const [state, setState] = useState(getState);

    const stateRef = useRef(state);
    stateRef.current = state;

    const optsRef = useRef(opts);
    optsRef.current = opts;

    useEffect(() => {
      let isMounted = true;

      function setStateIfChanged() {
        if (!isMounted) return;

        const prevState = stateRef.current;

        const newState = getState();

        if (
          prevState.isFetching !== newState.isFetching ||
          !areArraysEqual(prevState.errors, newState.errors)
        ) {
          setState((stateRef.current = newState));
        }
      }

      const promisesInFly = new Set<Promise<unknown>>();
      const unsubscribeIsFetching = scheduler.subscribeResolve(
        (promise, selection) => {
          if (!isSelectionIncluded(selection, selectionsToFilter)) {
            return;
          }

          if (!promisesInFly.has(promise)) {
            if (promisesInFly.size === 0) optsRef.current.onIsFetching?.();

            promisesInFly.add(promise);

            setStateIfChanged();

            promise.then(() => {
              promisesInFly.delete(promise);

              if (promisesInFly.size === 0) optsRef.current.onDoneFetching?.();

              setStateIfChanged();
            });
          }
        }
      );

      const unsubscribeErrors = scheduler.errors.subscribeErrors((data) => {
        if ('newError' in data) {
          if (hasFilterSelections) {
            const isIncluded = isAnySelectionIncluded(
              selectionsToFilter,
              data.selections
            );

            if (isIncluded) optsRef.current.onNewError?.(data.newError);
            else return;
          } else {
            optsRef.current.onNewError?.(data.newError);
          }
        } else if ('selectionsCleaned' in data && hasFilterSelections) {
          const isIncluded = isAnySelectionIncluded(
            selectionsToFilter,
            data.selectionsCleaned
          );

          if (!isIncluded) return;
        } else if ('retryPromise' in data) {
          if (hasFilterSelections) {
            const isIncluded = isAnySelectionIncluded(
              selectionsToFilter,
              data.selections
            );

            if (isIncluded) {
              setStateIfChanged();
              data.retryPromise.finally(() => {
                setTimeout(() => {
                  setStateIfChanged();
                });
              });
            }
          } else {
            setStateIfChanged();
            data.retryPromise.finally(() => {
              setTimeout(() => {
                setStateIfChanged();
              }, 0);
            });
          }
        }

        setStateIfChanged();
      });

      return () => {
        isMounted = false;
        unsubscribeIsFetching();
        unsubscribeErrors();
      };
    }, [getState, hasFilterSelections, setState, optsRef, selectionsToFilter]);

    return state;
  }

  return useMetaState;
}
