import { useMutation, useSubscription } from '../components/client';

let n = 0;

function SendNotification() {
  const [sendNotification] = useMutation((mutation, message: string) => {
    return mutation.sendNotification({
      message,
    });
  });

  return (
    <>
      <button
        onClick={() => {
          n++;
          sendNotification({
            args: `NOTIFICATION=${n}`,
          });
        }}
      >
        Send New Notification
      </button>
      <button
        onClick={() => {
          sendNotification({
            args: 'ERROR',
          });
        }}
      >
        Send Error Notification
      </button>
    </>
  );
}

export default function SubscriptionsPage() {
  const subscription = useSubscription();

  return (
    <div>
      <div>
        <h1>Data</h1>
        {subscription.newNotification}
      </div>
      <SendNotification />
    </div>
  );
}
