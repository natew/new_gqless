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

export function areSetsEqual(a: Set<unknown>, b: Set<unknown>) {
  if (a.size !== b.size) return false;

  return Array.from(a).every((value) => b.has(value));
}

export type ReactClientOptionsWithDefaults = Omit<
  CreateReactClientOptions,
  'defaults'
> & {
  defaults: Required<ReactClientDefaults>;
};
