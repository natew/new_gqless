import { waitForExpect } from 'test-utils';

import { createTestClient } from './utils';

test('subscriptions work', async () => {
  const { subscription, mutation, scheduler, server } = await createTestClient(
    undefined,
    undefined,
    {
      subscriptions: true,
    }
  );

  try {
    subscription.newNotification;

    await scheduler.resolving!.promise;

    mutation.sendNotification({
      message: 'THIS_IS_A_MESSAGE',
    });

    await scheduler.resolving!.promise;

    waitForExpect(() => {
      expect(subscription.newNotification).toBe('THIS_IS_A_MESSAGE');
    }, 100);
  } finally {
    await server.close();
  }
});
