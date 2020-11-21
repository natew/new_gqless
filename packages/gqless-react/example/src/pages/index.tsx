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

  const [n, inc] = useReducer((state: number) => {
    return ++state;
  }, 1);

  return (
    <div style={{ whiteSpace: 'pre-wrap' }}>
      {queryFromHook.__typename}
      <br />
      <br />
      <button onClick={inc}>inc</button>

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
