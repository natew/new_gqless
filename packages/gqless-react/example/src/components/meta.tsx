import { useMetaState } from './client';
import Link from 'next/link';

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
      <br />
      <nav>
        <Link href="/">
          <a>/</a>
        </Link>
        <br />
        <Link href="/normalized">
          <a>/normalized</a>
        </Link>{' '}
        <br />
        <Link href="/refetch">
          <a>/refetch</a>
        </Link>{' '}
        <br />
        <Link href="/stringArray">
          <a>/stringArray</a>
        </Link>{' '}
        <br />
        <Link href="/ssr">
          <a>/ssr</a>
        </Link>{' '}
        <br />
        <Link href="/polling">
          <a>/polling</a>
        </Link>{' '}
        <br />
        <Link href="/error">
          <a>/error</a>
        </Link>{' '}
        <br />
        <Link href="/playground">
          <a>/playground</a>
        </Link>{' '}
        <br />
        <Link href="/pagination">
          <a>/pagination</a>
        </Link>{' '}
        <br />
        <Link href="/pagination_infinite_scroll">
          <a>/pagination_infinite_scroll</a>
        </Link>{' '}
        <br />
        <Link href="/cache">
          <a>/cache</a>
        </Link>{' '}
        <br />
        <Link href="/emptyArrays">
          <a>/emptyArrays</a>
        </Link>{' '}
        <br />
      </nav>
    </div>
  );
};
