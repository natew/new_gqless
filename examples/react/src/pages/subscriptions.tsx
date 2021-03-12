import { useMutation, useSubscription } from '../components/client';

let n = 0;

function SendNotification() {
  const [sendNotification] = useMutation((mutation) => {
    return mutation.sendNotification({
      message: `NOTIFICATION=${n}`,
    });
  });

  return (
    <button
      onClick={() => {
        n++;
        sendNotification();
      }}
    >
      Send New Notification
    </button>
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
