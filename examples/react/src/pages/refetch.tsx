import { useQuery, useRefetch } from '../components/client';

export default function RefetchPage() {
  const query = useQuery();

  const refetchTime = useRefetch();

  const time = query.time;

  refetchTime.stopWatching();

  const refetchQueryTypename = useRefetch();

  const queryTypename = query.__typename;

  return (
    <div>
      <p>{time}</p>
      <button onClick={() => refetchTime()}>
        Refetch time{refetchTime.isLoading ? '...' : ''}
      </button>
      <br />
      <p>{queryTypename}</p>
      <button onClick={() => refetchQueryTypename()}>
        Refetch query typename{refetchQueryTypename.isLoading ? '...' : ''}
      </button>
    </div>
  );
}
