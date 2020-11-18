import { useEffect, useState } from 'react';

import { Thing } from '../../../';
import { query, resolved } from '../graphql/gqless';

export default function Index() {
  const [state, setState] = useState<typeof query['hello']>();

  useEffect(() => {
    resolved(() => query.hello).then(setState);
  }, []);

  return (
    <>
      {state}
      <Thing />
    </>
  );
}
