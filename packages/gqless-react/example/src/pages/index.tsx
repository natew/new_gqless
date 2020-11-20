import { createReactClient } from '../../../';
import { client, GeneratedSchema, selectFields } from '../graphql/gqless';

const { useTransactionQuery, useQuery } = createReactClient<GeneratedSchema>(
  client
);

export default function Index() {
  const query = useQuery();
  const { data } = useTransactionQuery((query) => {
    return query.dogs.map((dog) => {
      return {
        dogName: dog.name,
        owner: dog.owner?.__typename ? 'has owner 😁' : 'no owner 😔',
      };
    });
  });

  return (
    <div style={{ whiteSpace: 'pre-wrap' }}>
      {JSON.stringify(selectFields(query.dogs, '*', 2))}
      <br />
      <br />
      {JSON.stringify(data, null, 2)}
    </div>
  );
}
