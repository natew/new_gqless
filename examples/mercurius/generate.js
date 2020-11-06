const { writeGenerate } = require('gqless-cli');
const { app } = require('./');

(async () => {
  await app.ready();

  const destinationPath = await writeGenerate(
    app.graphql.schema,
    './src/generated/gqless.ts',
    {
      preImport: `
        import { createMercuriusTestClient } from "mercurius-integration-testing";
        import { app } from "../";
        `,
      queryFetcher: `
        const testClient = createMercuriusTestClient(app);
        const queryFetcher: QueryFetcher = function (query, variables) {
            return testClient.query(query, {
                variables,
            });
        }
        `,
      scalars: {
        ExampleScalar: 'string',
      },
    }
  );

  console.log(`gqless schema generated at ${destinationPath}`);
})();
