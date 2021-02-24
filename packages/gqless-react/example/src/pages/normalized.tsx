import { selectFields } from '@dish/gqless';
import { useMutation, useQuery } from '../components/client';

export default function NormalizedPage() {
  const query = useQuery({
    suspense: false,
    staleWhileRevalidate: true,
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
      <p style={{ whiteSpace: 'pre-wrap' }}>
        {JSON.stringify(selectFields(query.humans, '*', 2), null, 2)}
      </p>
    </div>
  );
}
