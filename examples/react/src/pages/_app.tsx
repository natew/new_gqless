import type { AppProps } from 'next/app';
import { Suspense } from 'react';

import { MetaClient } from '../components/meta';
import { NoSSR } from '../components/NoSSR';
import SSRPage from './ssr';

function MyApp({ Component, pageProps }: AppProps) {
  if (Component === SSRPage) {
    return (
      <>
        <MetaClient />
        <Component {...pageProps} />
      </>
    );
  }
  return (
    <NoSSR>
      <Suspense fallback="Root Loading...">
        <MetaClient />
        <Component {...pageProps} />
      </Suspense>
    </NoSSR>
  );
}

export default MyApp;
