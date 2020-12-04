import { useReducer } from 'react';

import { selectFields } from '@dish/gqless';

import { createReactClient } from '../../../';
import { Suspense } from '../components/Suspense';
import { client, GeneratedSchema, query } from '../graphql/gqless';

const defaultSuspense = true;

const {
  useTransactionQuery,
  useQuery,
  graphql,
  state,
  useRefetch,
} = createReactClient<GeneratedSchema>(client, {
  defaultSuspense,
});

const Comp = graphql(function Asd() {
  const queryFromHook = useQuery();
  const { data } = useTransactionQuery((query) => {
    return query.dogs.map((dog) => {
      return {
        dogName: dog.name,
        owner: dog.owner?.__typename ? 'has owner 😁' : 'no owner 😔',
      };
    });
  });

  const [n, dispatch] = useReducer(
    (state: number, action: 'add' | 'substact') => {
      return action === 'add' ? ++state : --state;
    },
    1
  );

  const typename = queryFromHook.__typename;

  const refetch = useRefetch();

  return (
    <div style={{ whiteSpace: 'pre-wrap' }}>
      <p>Time: {query.time}</p>
      {typename}
      <br />
      <br />
      <label>Depth: {n}</label>
      <button onClick={() => dispatch('add')}>add</button>
      <button onClick={() => dispatch('substact')}>substract</button>

      {!defaultSuspense && state.isLoading
        ? 'LOADING NO SUSPENSE'
        : JSON.stringify(selectFields(query.dogs, '*', n))}
      <br />
      <br />
      {JSON.stringify(data, null, 2)}

      <br />
      <button
        onClick={() => {
          refetch(query).catch(console.error);
        }}
      >
        Refetch everything
      </button>
    </div>
  );
});

export default function Index() {
  return (
    <Suspense fallback="Loading...">
      <Comp />
    </Suspense>
  );
}
