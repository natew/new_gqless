import { GetServerSideProps } from 'next';
import { renderToString } from 'react-dom/server';

import { prepareReactRender, useHydrateCache } from '../components/client';
import { default as IndexPage } from './refetch';

interface PageProps {
  page: string;
  cacheSnapshot: string;
}

export const getServerSideProps: GetServerSideProps<PageProps> = async () => {
  const { cacheSnapshot } = await prepareReactRender(<IndexPage />);

  const page = renderToString(<IndexPage />);

  return {
    props: {
      page,
      cacheSnapshot,
    },
  };
};

export default function SSRPage({ page, cacheSnapshot }: PageProps) {
  console.log(page);
  useHydrateCache({
    cacheSnapshot,
  });

  return <IndexPage />;
}
