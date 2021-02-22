import {
  refetch,
  graphql,
  usePolling,
  useTransactionQuery,
} from '../components/client';
import { Suspense } from '../components/Suspense';
import { Dog, query } from '../graphql/gqless';

const DogComp = ({ dog }: { dog: Dog }) => {
  const { data: transactionData } = useTransactionQuery(
    () => {
      return {
        name: dog.name,
      };
    },
    {
      pollInterval: 1000,
      skip: false,
    }
  );
  return (
    <li>
      <p>Transaction Name {transactionData?.name}</p>
      <p>{new Date().toISOString()}</p>
      <p>{dog.name}</p>
      <p>Owner: {dog.owner?.name ? dog.owner.name : 'No owner 😔'}</p>
      <button
        onClick={() => {
          refetch(() => {
            return dog.name;
          }).then((data) => {
            console.log('refetch done!', data);
          });
        }}
      >
        Refetch
      </button>
    </li>
  );
};

const Dogs = graphql(function Dogs() {
  const dogs = query.dogs;

  usePolling(
    () => {
      dogs.forEach((dog) => {
        dog.name;
      });
    },
    {
      pollInterval: 2000,
      notifyOnNetworkStatusChange: false,
    }
  );

  return (
    <ul>
      <li>XDXD {query.time}</li>
      {dogs.map((dog, index) => {
        return <DogComp key={index + 1} dog={dog} />;
      })}
    </ul>
  );
});

export default function Recursive() {
  return (
    <Suspense fallback="loading...">
      <Dogs />
    </Suspense>
  );
}
