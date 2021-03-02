import { useRef } from 'react';
import { graphql, useMutation } from '../components/client';
import { query } from '../graphql/gqless';

export default graphql(
  function CachePage() {
    const humans = query.humans;
    humans[0].name;

    const lastId = parseInt(humans[humans.length - 1].id ?? '0') + 1;
    const nameRef = useRef<HTMLInputElement>(null);
    const [createHuman, { isLoading: isCreatingHuman }] = useMutation(
      ({ createHuman }) => {
        const { id, name, __typename } = createHuman({
          id: lastId + '',
          name: nameRef.current?.value ?? 'No Name',
        });

        return { id, name, __typename };
      },
      {
        onCompleted(data) {
          humans.push(data);
        },
      }
    );

    return (
      <div>
        <input ref={nameRef} defaultValue="abc" />
        <button onClick={() => createHuman()} disabled={isCreatingHuman}>
          {isCreatingHuman ? 'Creating human...' : 'Create human'}
        </button>
        <p style={{ whiteSpace: 'pre-wrap' }}>
          {JSON.stringify(
            humans.map(({ id, name }) => ({ id, name })),
            null,
            2
          )}
        </p>
      </div>
    );
  },
  {
    suspense: {
      fallback: 'Loading...',
    },
    staleWhileRevalidate: true,
  }
);
