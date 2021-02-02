import type { AppProps } from 'next/app';
import { NoSSR } from '../components/NoSSR';
import { Suspense } from '../components/Suspense';

Suspense;

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <NoSSR>
      {/* <Suspense fallback="Loading..."> */}
      <Component {...pageProps} />
      {/* </Suspense> */}
    </NoSSR>
  );
}

export default MyApp;
