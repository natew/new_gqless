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
