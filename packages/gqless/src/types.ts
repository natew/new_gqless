import type { ExecutionResult } from "graphql";

export interface Type {
  __args?: Record<string, string>;
  __type: string;
}

export interface Schema extends Record<string, Record<string, Type>> {
  query: Record<string, Type>;
}
export interface Scalars extends Record<string, unknown> {
  String: string;
  Int: number;
}

export type ScalarsHash = { readonly [P in keyof Scalars]: true };

export type QueryFetcher = (
  query: string,
  variables?: Record<string, any>
) => Promise<ExecutionResult> | ExecutionResult;
