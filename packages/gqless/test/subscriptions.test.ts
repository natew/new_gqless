import { waitForExpect } from 'test-utils';
import { createDeferredPromise } from '../src/Utils';

import { createTestClient } from './utils';

test('subscriptions with scheduler', async () => {
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

    await waitForExpect(() => {
      expect(subscription.newNotification).toBe('THIS_IS_A_MESSAGE');
    }, 1000);
  } finally {
    await server.close();
  }
});

test.skip('subscriptions with resolved', async () => {
  const { resolved, subscription, mutate } = await createTestClient(
    undefined,
    undefined,
    {
      subscriptions: true,
    }
  );

  let data: typeof subscription.newNotification;

  const unsubscribePromise = createDeferredPromise<() => Promise<void>>();

  try {
    await resolved(
      () => {
        return subscription.newNotification;
      },
      {
        onSubscription(event) {
          unsubscribePromise.resolve(event.unsubscribe);

          switch (event.type) {
            case 'data': {
              data = event.data;
              return;
            }
          }
        },
      }
    );

    console.log('waiting for unsubscribe promise');
    await unsubscribePromise.promise;
    console.log('resolved unsubscribe');

    await mutate((mutation, { onComplete }) => {
      onComplete((data) => {
        console.log('notification sent!', data);
      });

      return mutation.sendNotification({
        message: 'OK',
      });
    });

    await waitForExpect(() => {
      expect(data).toBe('OK');
    }, 100);
  } finally {
    (await unsubscribePromise.promise)();
  }
}, 10000);
