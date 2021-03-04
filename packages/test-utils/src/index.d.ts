import { FastifyInstance } from 'fastify';
import { MercuriusOptions } from 'mercurius';
import { createMercuriusTestClient } from 'mercurius-integration-testing';
import * as randomstring from 'randomstring';
export declare function createTestApp(
  options: MercuriusOptions,
  {
    codegenPath,
  }?: {
    codegenPath?: string;
  }
): {
  server: FastifyInstance;
  client: ReturnType<typeof createMercuriusTestClient>;
  isReady: Promise<unknown>;
};
export { default as waitForExpect } from 'wait-for-expect';
export * as mercurius from 'mercurius';
export * as fastify from 'fastify';
export declare function assertIsDefined<T = unknown>(
  value: T,
  message?: string
): asserts value is NonNullable<T>;
export declare function gql(
  chunks: TemplateStringsArray,
  ...variables: any[]
): string;
export { randomstring };
