import { useQuery, useTransactionQuery } from '../components/client';
import { useErrorBoundary } from 'use-error-boundary';
import { NoSSR } from '../components/NoSSR';
import { Suspense } from 'react';

const ErrorComponent = () => {
  const query = useQuery({
    suspense: true,
  });

  return (
    <div>
      {JSON.stringify({
        a: query.thirdTry,
        b: query.__typename,
      })}
    </div>
  );
};

export default function ErrorPage() {
  const { ErrorBoundary, didCatch, error } = useErrorBoundary();
  return (
    <NoSSR>
      <div>{JSON.stringify(error)}</div>
      <div>{didCatch ? 'CATCH' : 'NO-CATCH'}</div>

      <Suspense fallback={<div>Loading...</div>}>
        <ErrorBoundary
          renderError={(err) => {
            return (
              <>
                <div>error!!!! </div>
              </>
            );
          }}
        >
          <ErrorComponent />
        </ErrorBoundary>
      </Suspense>
    </NoSSR>
  );
}
