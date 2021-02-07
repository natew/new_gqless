import type { AppProps } from 'next/app';
import { MetaClient } from '../components/meta';
import { NoSSR } from '../components/NoSSR';
import { Suspense } from '../components/Suspense';

Suspense;

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <NoSSR>
      {/* <Suspense fallback="Loading..."> */}
      <MetaClient />
      <Component {...pageProps} />
      {/* </Suspense> */}
    </NoSSR>
  );
}

export default MyApp;
