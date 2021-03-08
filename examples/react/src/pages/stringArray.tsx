import { useQuery, buildSelection } from '../components/client';
import { query } from '../graphql/gqless';

query.dogs;

typeof window !== 'undefined' &&
  console.log(
    'selection',
    buildSelection('query', 'dogs', 'owner', 'dogs', 'owner', 'name')
  );

export default function TestingStringArray() {
  const query = useQuery({
    suspense: false,
  });

  return (
    <div>
      {query.stringList.map((v, index) => (
        <p key={index}>{v}</p>
      ))}
    </div>
  );
}
