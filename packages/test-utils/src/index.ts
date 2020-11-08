import fastify, { FastifyInstance } from 'fastify';
import mercurius, { MercuriusOptions } from 'mercurius';
import { createMercuriusTestClient } from 'mercurius-integration-testing';

export function createTestApp(
  options: MercuriusOptions,
  {
    codegenPath,
  }: {
    codegenPath?: string;
  } = {}
): {
  server: FastifyInstance;
  client: ReturnType<typeof createMercuriusTestClient>;
  isReady: Promise<void>;
} {
  const server = fastify();

  server.register(mercurius, options);

  let isReady = codegenPath
    ? new Promise<void>((resolve, reject) => {
        import('mercurius-codegen')
          .then(({ default: mercuriusCodegen }) => {
            mercuriusCodegen(server, {
              targetPath: codegenPath,
              silent: true,
              disable: false,
            })
              .then(resolve)
              .catch(reject);
          })
          .catch(reject);
      })
    : ((server.ready() as unknown) as Promise<void>);

  const client = createMercuriusTestClient(server, {
    url: options.path,
  });

  return { server, client, isReady };
}

export { default as waitForExpect } from 'wait-for-expect';

export * as mercurius from 'mercurius';
export * as fastify from 'fastify';

export function assertIsDefined<T = unknown>(
  value: T,
  message?: string
): asserts value is NonNullable<T> {
  if (value == null) {
    const error = new Error(message || 'value is nullable');

    Error.captureStackTrace(error, assertIsDefined);
    throw error;
  }
}

export function gql(chunks: TemplateStringsArray, ...variables: any[]): string {
  return chunks.reduce(
    (accumulator, chunk, index) =>
      `${accumulator}${chunk}${index in variables ? variables[index] : ''}`,
    ''
  );
}
