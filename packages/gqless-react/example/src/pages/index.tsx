import { useReducer } from 'react';
import { createReactClient } from '../../../';
import { Suspense } from '../components/Suspense';
import {
  client,
  GeneratedSchema,
  selectFields,
  query,
} from '../graphql/gqless';

const defaultSuspense = false;

const {
  useTransactionQuery,
  useQuery,
  graphql,
  state,
} = createReactClient<GeneratedSchema>(client, {
  defaultSuspense,
});

const Comp = graphql(() => {
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

  return (
    <div style={{ whiteSpace: 'pre-wrap' }}>
      {queryFromHook.__typename}
      <br />
      <br />
      <p>
        {
          //@ts-expect-error
          performance.memory.totalJSHeapSize / 1024 / 1024
        }
      </p>
      <label>Depth: {n}</label>
      <button onClick={() => dispatch('add')}>add</button>
      <button onClick={() => dispatch('substact')}>substract</button>

      {!defaultSuspense && state.isLoading
        ? 'LOADING NO SUSPENSE'
        : JSON.stringify(selectFields(query.dogs, '*', n))}
      <br />
      <br />
      {JSON.stringify(data, null, 2)}
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
