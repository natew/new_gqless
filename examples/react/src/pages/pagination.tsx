import { useMemo, useState } from 'react';
import { useQuery } from '../components/client';

const amount = 3;
export default function PaginationPage() {
  const [after, setAfter] = useState<string | null | undefined>(null);
  const [before, setBefore] = useState<string | null | undefined>(null);
  const [first, setFirst] = useState<number | null>(amount);
  const [last, setLast] = useState<number | null>(null);

  const query = useQuery({
    staleWhileRevalidate: useMemo(() => {
      return {
        after,
        before,
        first,
        last,
      };
    }, [after, before, first, last]),
  });

  const {
    nodes,
    pageInfo: { startCursor, endCursor, hasNextPage, hasPreviousPage },
  } = query.paginatedHumans({
    input: {
      first,
      after,
      last,
      before,
    },
  });

  return (
    <div>
      <p style={{ whiteSpace: 'pre-wrap' }}>
        {JSON.stringify(
          {
            time: query.time,
            data: nodes.map(({ id, name }) => ({ id, name })),
            startCursor,
            endCursor,
            hasNextPage,
            hasPreviousPage,
          },
          null,
          2
        )}
      </p>
      <button
        disabled={!hasPreviousPage}
        onClick={() => {
          setAfter(null);
          setFirst(null);
          setLast(amount);
          setBefore(startCursor);
        }}
      >
        previous page
      </button>

      <button
        disabled={!hasNextPage}
        onClick={() => {
          setBefore(null);
          setLast(null);
          setAfter(endCursor);
          setFirst(amount);
        }}
      >
        next page
      </button>
    </div>
  );
}
