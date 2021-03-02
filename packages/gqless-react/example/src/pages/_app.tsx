import type { AppProps } from 'next/app';
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
      <MetaClient />
      <Component {...pageProps} />
    </NoSSR>
  );
}

export default MyApp;
