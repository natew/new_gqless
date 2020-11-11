import { Scheduler } from '../src/Scheduler';
import { createInterceptorManager } from '../src/Interceptor';
import { Selection } from '../src/Selection';
import { waitForExpect } from 'test-utils';

test('scheduler works with globalInterceptor', async () => {
  const interceptorManager = createInterceptorManager();

  const resolveAllSelections = jest.fn(async () => {});

  new Scheduler(interceptorManager, resolveAllSelections);

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
