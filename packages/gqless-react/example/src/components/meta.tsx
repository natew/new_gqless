import { useMetaState } from './client';

export const MetaClient = () => {
  const { isFetching, errors } = useMetaState({
    onIsFetching() {},
    onDoneFetching() {},
    onNewError() {},
  });

  return (
    <div
      style={{
        border: '1px solid black',
        padding: '5px',
        width: 'fit-content',
      }}
    >
      <p>{isFetching ? 'Fetching...' : 'Done'}</p>
      {errors && (
        <p style={{ whiteSpace: 'pre' }}>{JSON.stringify(errors, null, 2)}</p>
      )}
    </div>
  );
};
