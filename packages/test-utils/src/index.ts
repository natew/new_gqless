import fastify, { FastifyInstance } from 'fastify';
import mercurius, { MercuriusOptions } from 'mercurius';
import { createMercuriusTestClient } from 'mercurius-integration-testing';

export function createTestApp(
  options: MercuriusOptions
): {
  server: FastifyInstance;
  client: ReturnType<typeof createMercuriusTestClient>;
} {
  const server = fastify();

  server.register(mercurius, options);

  const client = createMercuriusTestClient(server, {
    url: options.path,
  });

  return { server, client };
}
