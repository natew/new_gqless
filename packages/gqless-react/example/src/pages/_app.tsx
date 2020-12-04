import type { AppProps } from 'next/app';
import { Suspense } from '../components/Suspense';

Suspense;

function MyApp({ Component, pageProps }: AppProps) {
  return (
    // <Suspense fallback="Loading...">
    <Component {...pageProps} />
    // </Suspense>
  );
}

export default MyApp;
