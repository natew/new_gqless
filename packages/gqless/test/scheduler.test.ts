import { waitForExpect } from 'test-utils';

import { createInterceptorManager } from '../src/Interceptor';
import { createScheduler } from '../src/Scheduler';
import { Selection } from '../src/Selection';

test('scheduler works with globalInterceptor', async () => {
  const interceptorManager = createInterceptorManager();

  const resolveAllSelections = jest.fn(() => {
    return new Promise<void>((resolve) => setTimeout(resolve, 500));
  });

  createScheduler(interceptorManager, resolveAllSelections, 10);

  const selection = new Selection({
    key: 'a',
  });

  interceptorManager.addSelection(selection);

  expect(
    interceptorManager.globalInterceptor.fetchSelections.has(selection)
  ).toBe(true);

  await waitForExpect(
    () => {
      expect(resolveAllSelections).toBeCalledTimes(1);
    },
    15,
    1
  );

  interceptorManager.addSelection(
    new Selection({
      key: 'b',
    })
  );

  await waitForExpect(
    () => {
      expect(resolveAllSelections).toBeCalledTimes(2);
    },
    15,
    1
  );
});

test('scheduler resolve subscriptions', async () => {
  const interceptorManager = createInterceptorManager();

  const fetchedSelections = new Set<Selection>();

  let fetchCalls = 0;

  const ExpectedError = Error('expected');

  const resolveAllSelections = jest.fn(async () => {
    fetchCalls += 1;

    if (fetchCalls >= 3) throw ExpectedError;

    interceptorManager.globalInterceptor.fetchSelections.forEach((s) =>
      fetchedSelections.add(s)
    );
    interceptorManager.globalInterceptor.removeSelections(
      interceptorManager.globalInterceptor.fetchSelections
    );
  });

  const scheduler = createScheduler(
    interceptorManager,
    resolveAllSelections,
    10
  );

  let subscriptionCalls = 0;
  const subscribePromise = new Promise<() => void>((resolve, reject) => {
    const unsubscribe = scheduler.subscribeResolve((promise) => {
      subscriptionCalls += 1;
      promise.then(() => {
        resolve(unsubscribe);
      }, reject);
    });
  });
  expect(subscriptionCalls).toBe(0);
  expect(scheduler.resolving).toBe(null);

  const selectionA = new Selection({
    key: 'a',
  });
  interceptorManager.globalInterceptor.addSelection(selectionA);
  expect(scheduler.resolving).toBeTruthy();
  expect(subscriptionCalls).toBe(1);
  expect(fetchCalls).toBe(0);

  const unsubscribe = await subscribePromise;

  expect(scheduler.resolving).toBe(null);

  expect(fetchCalls).toBe(1);

  expect(fetchedSelections.has(selectionA)).toBeTruthy();

  unsubscribe();

  const selectionB = new Selection({
    key: 'b',
  });
  interceptorManager.globalInterceptor.addSelection(selectionB);

  expect(subscriptionCalls).toBe(1);

  expect(fetchCalls).toBe(1);
  expect(scheduler.resolving).toBeTruthy();
  await scheduler.resolving!.promise;

  expect(fetchCalls).toBe(2);

  expect(fetchedSelections.has(selectionB)).toBeTruthy();

  const selectionC = new Selection({
    key: 'c',
  });
  const selectionD = new Selection({
    key: 'd',
  });

  const spy = jest.spyOn(console, 'error').mockImplementationOnce((err) => {
    expect(err).toBe(ExpectedError);
  });

  try {
    interceptorManager.globalInterceptor.addSelection(selectionC);
    interceptorManager.globalInterceptor.addSelection(selectionD);

    expect(scheduler.resolving).toBeTruthy();

    const result = await scheduler.resolving!.promise;

    expect(result?.error).toBe(ExpectedError);

    expect(spy).toBeCalledTimes(1);
  } finally {
    spy.mockRestore();
  }
});
