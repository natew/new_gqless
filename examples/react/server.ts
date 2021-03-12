import Fastify from 'fastify';
import ms from 'ms';
import FastifyNext from 'fastify-nextjs';
import { register } from './src/api/graphql';

const app = Fastify({
  logger: true,
  pluginTimeout: ms('60 seconds'),
});

register(app).catch(console.error);

app
  .register(FastifyNext, {
    logLevel: 'error',
  })
  .after(() => {
    app.next('/*');
  });

app.listen(4141, (err) => {
  if (err) throw err;
});
