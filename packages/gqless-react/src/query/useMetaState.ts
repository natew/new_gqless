import type {
  createClient,
  gqlessError,
  BuildSelectionInput,
} from '@dish/gqless';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Selection } from '@dish/gqless';

import { useUpdateEffect } from '../common';
import { areArraysEqual } from '../utils';

export interface UseGqlessStateOptions {
  onIsFetching?: () => void;
  onDoneFetching?: () => void;
  onNewError?: (error: gqlessError) => void;
  filterSelections?: (Selection | BuildSelectionInput)[];
}

function initSelectionsState() {
  return new Set<Selection>();
}

export function createUseMetaState(client: ReturnType<typeof createClient>) {
  const scheduler = client.scheduler;

  const { buildSelection } = client;

  const errorsMap = scheduler.errors.map;

  const defaultEmptyOpts = {};

  function useMetaState(opts: UseGqlessStateOptions = defaultEmptyOpts) {
    const argFilterSelections = opts.filterSelections;
    const hasFilterSelections = Boolean(argFilterSelections);

    const [selectionsToFilter] = useState(initSelectionsState);

    const buildSelectionsToFilter = useCallback(() => {
      selectionsToFilter.clear();

      if (!argFilterSelections) return;

      try {
        for (const filterValue of argFilterSelections) {
          if (filterValue instanceof Selection) {
            selectionsToFilter.add(filterValue);
          } else {
            selectionsToFilter.add(buildSelection(...filterValue));
          }
        }
      } catch (err) {
        if (err instanceof Error && Error.captureStackTrace!) {
          Error.captureStackTrace(err, useMetaState);
        }

        throw err;
      }
    }, [argFilterSelections, selectionsToFilter]);

    const [state, setState] = useState<{
      isFetching: boolean;
      errors?: gqlessError[];
    }>(() => {
      buildSelectionsToFilter();

      const isFetching =
        scheduler.pendingSelectionsGroups.size > 0
          ? hasFilterSelections
            ? (() => {
                const selectionsGroups = Array.from(
                  scheduler.pendingSelectionsGroups
                );
                const selectionsToFilterArray = Array.from(selectionsToFilter);

                for (const group of selectionsGroups) {
                  for (const selection of selectionsToFilterArray) {
                    if (group.has(selection)) return true;
                  }
                }

                return false;
              })()
            : true
          : false;

      const errors = hasFilterSelections
        ? (() => {
            const errorsSet = new Set<gqlessError>();

            selectionsToFilter.forEach((selection) => {
              const error = errorsMap.get(selection);

              if (error) errorsSet.add(error);
            });

            return errorsSet.size ? Array.from(errorsSet) : null;
          })()
        : (() => {
            return errorsMap.size
              ? Array.from(new Set(errorsMap.values()))
              : null;
          })();

      return errors ? { isFetching, errors } : { isFetching };
    });

    const stateRef = useRef(state);
    stateRef.current = state;

    const optsRef = useRef(opts);
    optsRef.current = opts;

    useUpdateEffect(() => {
      buildSelectionsToFilter();
    }, [buildSelectionsToFilter]);

    useEffect(() => {
      let isMounted = true;

      function isSelectionIncluded(selection: Selection) {
        if (selectionsToFilter.has(selection)) return true;

        for (const listValue of selection.selectionsList) {
          if (selectionsToFilter.has(listValue)) return true;
        }

        return false;
      }

      function setStateIfChanged() {
        if (!isMounted) return;

        const prevState = stateRef.current;

        const isFetching =
          scheduler.pendingSelectionsGroups.size > 0
            ? hasFilterSelections
              ? (() => {
                  const selectionsGroups = Array.from(
                    scheduler.pendingSelectionsGroups
                  );
                  const selectionsToFilterArray = Array.from(
                    selectionsToFilter
                  );

                  for (const group of selectionsGroups) {
                    for (const selection of selectionsToFilterArray) {
                      if (group.has(selection)) return true;
                    }
                  }

                  return false;
                })()
              : true
            : false;
        const errors = hasFilterSelections
          ? (() => {
              const errorsSet = new Set<gqlessError>();

              selectionsToFilter.forEach((selection) => {
                const error = errorsMap.get(selection);

                if (error) errorsSet.add(error);
              });

              return errorsSet.size ? Array.from(errorsSet) : undefined;
            })()
          : (() => {
              return errorsMap.size
                ? Array.from(new Set(errorsMap.values()))
                : undefined;
            })();

        if (
          prevState.isFetching !== isFetching ||
          !areArraysEqual(prevState.errors, errors)
        ) {
          setState(
            (stateRef.current = errors
              ? { isFetching, errors }
              : { isFetching })
          );
        }
      }

      const promisesInFly = new Set<Promise<unknown>>();
      const unsubscribeIsFetching = scheduler.subscribeResolve(
        (promise, selection) => {
          if (!isSelectionIncluded(selection)) return;

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
            const isIncluded = data.selections.some((selection) =>
              isSelectionIncluded(selection)
            );

            if (isIncluded) optsRef.current.onNewError?.(data.newError);
            else return;
          } else {
            optsRef.current.onNewError?.(data.newError);
          }
        } else if (hasFilterSelections) {
          const isIncluded = data.selectionsCleaned.some((selection) =>
            isSelectionIncluded(selection)
          );

          if (!isIncluded) return;
        }

        setStateIfChanged();
      });

      return () => {
        isMounted = false;
        unsubscribeIsFetching();
        unsubscribeErrors();
      };
    }, [hasFilterSelections, setState, optsRef, selectionsToFilter]);

    return state;
  }

  return useMetaState;
}
