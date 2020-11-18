import Fastify from 'fastify';
import mercurius from 'mercurius';
import { gql, codegenMercurius } from 'mercurius-codegen';
import { NextApiHandler } from 'next';

import { writeGenerate } from '@dish/gqless-cli';

const app = Fastify();

app.register(mercurius, {
  schema: gql`
    type Query {
      hello: String!
    }
  `,
  resolvers: {
    Query: {
      hello() {
        return 'world';
      },
    },
  },
});

codegenMercurius(app, {
  targetPath: './src/graphql/mercurius.ts',
}).catch(console.error);

const ready = new Promise(async (resolve) => {
  await app.ready();

  writeGenerate(app.graphql.schema, './src/graphql/gqless.ts', {
    queryFetcher: `
    const queryFetcher: QueryFetcher = async function (query, variables) {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables,
        }),
        mode: 'cors',
      });
   
    if (!response.ok) {
      throw new Error(\`Network error, received status code \${response.status}\`);
    }
   
    const json = await response.json();
   
    return json;
   };
    `,
  }).catch(console.error);

  resolve();
});

const GraphQLRoute: NextApiHandler = async (req, res) => {
  await ready;
  const response = await app.inject({
    method: req.method as any,
    headers: req.headers,
    payload: req.body,
    query: req.query,
    url: '/graphql',
  });

  res.send(response.body);
};

export default GraphQLRoute;
