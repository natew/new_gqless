import dynamic from 'next/dynamic';

import type { SuspenseProps } from 'react';

export const Suspense = dynamic<SuspenseProps>(
  () => import('react').then(({ Suspense }) => Suspense),
  { ssr: false }
);
