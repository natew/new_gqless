import { graphql, useQuery } from '../components/client';

export default graphql(
  function EmptyArrays() {
    const query = useQuery({
      suspense: true,
    });
    const scalar = query.emptyScalarArray.map((v) => v);
    const humans = query.emptyHumanArray.map((v) => v.id);

    return (
      <p style={{ whiteSpace: 'pre-wrap' }}>
        {JSON.stringify({ scalar, humans }, null, 2)}
      </p>
    );
  },
  {
    suspense: {
      fallback: 'Loading...',
    },
  }
);
