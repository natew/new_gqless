import { useQuery } from '../components/client';
import { query } from '../graphql/gqless';
import { useErrorBoundary } from 'use-error-boundary';
import { NoSSR } from '../components/NoSSR';

const ErrorComponent = () => {
  const query = useQuery({
    suspense: true,
  });

  return <div>{query.expectedError}</div>;
};

export default function ErrorPage() {
  const { ErrorBoundary, didCatch } = useErrorBoundary();
  return (
    <NoSSR>
      <div>{didCatch ? 'CATCH' : 'NO-CATCH'}</div>
      <ErrorBoundary
        renderError={(err) => {
          return <div>error!!!!</div>;
        }}
      >
        <ErrorComponent />
      </ErrorBoundary>
    </NoSSR>
  );
}
