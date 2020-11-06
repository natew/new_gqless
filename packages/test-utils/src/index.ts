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
