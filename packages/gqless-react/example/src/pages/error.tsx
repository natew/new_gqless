import { useLazyQuery } from '../components/client';
export default function ErrorPage() {
  const [getError] = useLazyQuery();

  return (
    <div>
      <button
        onClick={() => {
          getError((query) => {
            return query.expectedError;
          })
            .then((value) => {
              console.log(value);
            })
            .catch(() => {});
        }}
      >
        Click here
      </button>
    </div>
  );
}
