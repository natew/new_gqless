import { selectFields } from '@dish/gqless';
import { useMutation, useQuery } from '../components/client';

export default function NormalizedPage() {
  const query = useQuery({
    suspense: false,
    cacheAndNetwork: true,
  });

  const [renameDog] = useMutation((mutation) => {
    const dog = mutation.renameDog({
      id: '1',
      name: 'z',
    });

    dog?.id;
    dog?.name;
  });

  const [renameHuman] = useMutation((mutation) => {
    const human = mutation.renameHuman({
      id: '1',
      name: 'x',
    });

    human?.id;
    human?.name;
  });

  return (
    <div>
      <button onClick={() => renameDog()}>rename dog</button>
      <button onClick={() => renameHuman()}>rename human</button>
      <p>{JSON.stringify(selectFields(query.humans, '*', 5))}</p>
    </div>
  );
}
