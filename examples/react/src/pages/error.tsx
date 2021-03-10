import { useQuery, useTransactionQuery } from '../components/client';
import { NoSSR } from '../components/NoSSR';
import { Suspense, useState } from 'react';
import { serializeError } from 'serialize-error';
import { gqlessError } from '@dish/gqless';

const ExpectedErrorComponent = () => {
  const { data, error } = useTransactionQuery(
    (query) => {
      return {
        a: query.thirdTry,
        b: query.__typename,
      };
    },
    {
      suspense: true,
      retry: true,
      fetchPolicy: 'no-cache',
    }
  );

  const [inlineError, setError] = useState<gqlessError>();

  const query = useQuery({
    suspense: true,
    onError: setError,
  });

  return (
    <>
      <div>
        {<p>HOOK DATA:{JSON.stringify(data)}</p>}
        {error && <p>HOOK ERROR: {JSON.stringify(serializeError(error))}</p>}
      </div>
      <div>
        INLINE DATA:{' '}
        {JSON.stringify({
          a: query.expectedError,
          b: query.__typename,
        })}
        {inlineError && (
          <p>INLINE ERROR: {JSON.stringify(serializeError(inlineError))}</p>
        )}
      </div>
    </>
  );
};

export default function ErrorPage() {
  return (
    <NoSSR>
      <Suspense fallback={<div>Loading Here...</div>}>
        <ExpectedErrorComponent />
      </Suspense>
    </NoSSR>
  );
}
