import { refetch, graphql } from '../components/client';
import { Suspense } from '../components/Suspense';
import { Dog, query } from '../graphql/gqless';

const DogComp = ({ dog }: { dog: Dog }) => {
  return (
    <li>
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

const Dogs = graphql(() => {
  const dogs = query.dogs;
  return (
    <ul>
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
