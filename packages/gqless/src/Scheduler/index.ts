import debounce from 'lodash/debounce';
import { gqlessError } from '../Error';

import { InterceptorManager } from '../Interceptor';
import { Selection } from '../Selection';
import { createLazyPromise, LazyPromise } from '../Utils';

export type Scheduler = ReturnType<typeof createScheduler>;

export type SchedulerPromiseValue = { error: unknown } | null;

export type ErrorSubscriptionFn = (
  data:
    | {
        newError: gqlessError;
        selections: Selection[];
      }
    | {
        selectionsCleaned: Selection[];
      }
) => void;

export type IsFetchingSubscriptionFn = (isFetching: boolean) => void;

export const createScheduler = (
  { globalInterceptor }: InterceptorManager,
  resolveSelections: (selections: Set<Selection>) => Promise<void>,
  catchSelectionsTimeMS: number
) => {
  type ResolvingLazyPromise = LazyPromise<SchedulerPromiseValue>;
  type ResolvedLazyPromise = Promise<SchedulerPromiseValue>;

  type ResolveSubscriptionFn = (
    promise: ResolvedLazyPromise,
    selection: Selection
  ) => void;

  const resolveListeners = new Set<ResolveSubscriptionFn>();

  function subscribeResolve(fn: ResolveSubscriptionFn) {
    resolveListeners.add(fn);

    return function unsubscribe() {
      resolveListeners.delete(fn);
    };
  }

  const errorsMap = new Map<Selection, gqlessError>();

  const scheduler = {
    resolving: null as null | ResolvingLazyPromise,
    subscribeResolve,
    errors: {
      map: errorsMap,
      subscribeErrors,
      triggerError,
      removeErrors,
    },
    isFetching: false,
    subscribeIsFetching,
  };

  const errorsListeners = new Set<ErrorSubscriptionFn>();

  function subscribeErrors(fn: ErrorSubscriptionFn) {
    errorsListeners.add(fn);

    return function unsubscribe() {
      errorsListeners.delete(fn);
    };
  }

  function triggerError(newError: gqlessError, selections: Selection[]) {
    for (const selection of selections) errorsMap.set(selection, newError);

    const data = {
      newError,
      selections,
    };
    errorsListeners.forEach((listener) => {
      listener(data);
    });
  }

  function removeErrors(selectionsCleaned: Selection[]) {
    if (errorsMap.size === 0) return;

    for (const selection of selectionsCleaned) errorsMap.delete(selection);

    const data = {
      selectionsCleaned,
    };
    errorsListeners.forEach((listener) => {
      listener(data);
    });
  }

  const pendingRequests = new Set<ResolvingLazyPromise>();

  const isFetchingListeners = new Set<IsFetchingSubscriptionFn>();

  function subscribeIsFetching(fn: IsFetchingSubscriptionFn) {
    isFetchingListeners.add(fn);

    return function unsubscribe() {
      isFetchingListeners.delete(fn);
    };
  }

  function addPendingRequest(resolvingPromise: ResolvingLazyPromise) {
    pendingRequests.add(resolvingPromise);
    if (!scheduler.isFetching) {
      isFetchingListeners.forEach((listener) => {
        listener(true);
      });
    }

    return function RemovePendingRequest() {
      pendingRequests.delete(resolvingPromise);

      if (pendingRequests.size === 0) {
        isFetchingListeners.forEach((listener) => {
          listener(false);
        });
      }
    };
  }

  let resolvingPromise: ResolvingLazyPromise | null = null;

  const pendingSelectionsGroups = new Set<Set<Selection>>();

  const fetchSelections = debounce((lazyPromise: ResolvingLazyPromise) => {
    resolvingPromise = null;

    const selectionsToFetch = new Set(globalInterceptor.fetchSelections);

    pendingSelectionsGroups.add(selectionsToFetch);

    resolveSelections(selectionsToFetch).then(
      () => {
        pendingSelectionsGroups.delete(selectionsToFetch);
        if (scheduler.resolving === lazyPromise) scheduler.resolving = null;
        lazyPromise.resolve(null);
      },
      (error) => {
        pendingSelectionsGroups.delete(selectionsToFetch);
        if (scheduler.resolving === lazyPromise) scheduler.resolving = null;
        lazyPromise.resolve({
          error,
        });
      }
    );
  }, catchSelectionsTimeMS);

  globalInterceptor.selectionAddListeners.add((selection) => {
    for (const group of pendingSelectionsGroups) {
      if (group.has(selection)) return;
    }

    let lazyPromise: ResolvingLazyPromise;
    if (resolvingPromise === null) {
      lazyPromise = createLazyPromise();

      const removePendingRequest = addPendingRequest(lazyPromise);

      lazyPromise.promise.then((result) => {
        removePendingRequest();

        if (result) console.error(result.error);
      });

      resolvingPromise = lazyPromise;
      scheduler.resolving = lazyPromise;
    } else {
      lazyPromise = resolvingPromise;
    }
    const promise = lazyPromise.promise;
    resolveListeners.forEach((subscription) => {
      subscription(promise, selection);
    });
    fetchSelections(lazyPromise);
  });

  return scheduler;
};
