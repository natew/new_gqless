import type { CreateReactClientOptions, ReactClientDefaults } from './client';

export function areArraysEqual(
  a: unknown[] | null | undefined,
  b: unknown[] | null | undefined
) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; ++i) if (a[i] !== b[i]) return false;

  return true;
}

export type ReactClientOptionsWithDefaults = Omit<
  CreateReactClientOptions,
  'defaults'
> & {
  defaults: Required<ReactClientDefaults>;
};
