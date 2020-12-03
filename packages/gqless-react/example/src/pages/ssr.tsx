import { GetServerSideProps } from 'next';
import { renderToString } from 'react-dom/server';
import ssrPrepass from 'react-ssr-prepass';
import { client, query, refetch } from '../graphql/gqless';
import { default as IndexPage } from './refetch';

export const getServerSideProps: GetServerSideProps = async () => {
  await ssrPrepass(<IndexPage />);

  await client.scheduler.resolving?.promise;

  const page = renderToString(<IndexPage />);

  return {
    props: {
      page,
      cache: client.cache,
    },
  };
};

export default function SSRPage({
  page,
  cache,
}: {
  page: string;
  cache: Record<string, unknown>;
}) {
  console.log('PAGE', page);
  if (typeof cache.query === 'object') {
    client.setCache(query, cache.query);
    setTimeout(() => {
      refetch(query);
    }, 2000);
  }

  return <IndexPage />;
}
