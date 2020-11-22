import { waitForExpect } from 'test-utils';

import { createInterceptorManager } from '../src/Interceptor';
import { createScheduler } from '../src/Scheduler';
import { Selection } from '../src/Selection';

test('scheduler works with globalInterceptor', async () => {
  const interceptorManager = createInterceptorManager();

  const resolveAllSelections = jest.fn(async () => {});

  createScheduler(interceptorManager, resolveAllSelections);

  const selection = new Selection({
    key: 'a',
  });

  interceptorManager.addSelection(selection);

  expect(interceptorManager.globalInterceptor.selections.has(selection)).toBe(
    true
  );

  await waitForExpect(
    () => {
      expect(resolveAllSelections).toBeCalledTimes(1);
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

    interceptorManager.globalInterceptor.selections.forEach((s) =>
      fetchedSelections.add(s)
    );
    interceptorManager.globalInterceptor.removeSelections(
      interceptorManager.globalInterceptor.selections
    );
  });

  const scheduler = createScheduler(interceptorManager, resolveAllSelections);

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
  await scheduler.resolving;
  expect(fetchCalls).toBe(2);

  expect(fetchedSelections.has(selectionB)).toBeTruthy();

  interceptorManager.globalInterceptor.addSelection(selectionB);

  expect(scheduler.resolving).toBeTruthy();
  try {
    await scheduler.resolving;

    throw Error("Shouldn't reach this");
  } catch (err) {
    expect(err).toBe(ExpectedError);
  }
});
