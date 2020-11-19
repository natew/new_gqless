import { createReactClient } from '../../../';
import { client, GeneratedSchema } from '../graphql/gqless';

const { useQuery } = createReactClient<GeneratedSchema>(client);

export default function Index() {
  const { data } = useQuery((query) => {
    return query.hello;
  });

  return (
    <>
      {data}
      <div>123</div>
    </>
  );
}
