import { useQuery } from '../components/client';
import { ErrorBoundary } from 'react-error-boundary';
const ErrorComponent = () => {
  const query = useQuery();

  return <div>{query.expectedError}</div>;
};

export default function ErrorPage() {
  return (
    <>
      <div>123</div>
      <ErrorBoundary
        onError={(err) => {
          console.log(
            1515,
            JSON.stringify({
              err,
            })
          );
        }}
        fallbackRender={() => {
          return <>error</>;
        }}
      >
        <ErrorComponent />
      </ErrorBoundary>
    </>
  );
}
