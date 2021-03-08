#!/usr/bin/env node

const { program } = require('commander');
const { existsSync } = require('fs');
const { resolve } = require('path');
const {
  inspectWriteGenerate,
  defaultConfig,
  gqlessConfigPromise,
} = require('../dist/index');

program.version('4.0.4').description('CLI for gqless');

program
  .command('generate [endpoint] [destination]')
  .option('--react', 'Create React client')
  .description(
    `Inspect or read from a file a GraphQL Schema and generate the gqless client in the specified directory (./src/generated/graphql.ts by default).
EXAMPLE 1: "gqless generate ./schema.gql --react" 
EXAMPLE 2: "gqless generate http://localhost:3000/graphql src/generated/index.ts"
EXAMPLE 3 (Configuration file): "gqless generate"`
  )
  .action(async (endpoint, destination, opts) => {
    let react;
    if (opts.react != null) {
      react = defaultConfig.react =
        typeof opts.react === 'boolean' ? opts.react : !!opts.react;
    }

    if (destination) {
      defaultConfig.destination = destination;
    }

    if (endpoint) {
      defaultConfig.endpoint = endpoint;
      defaultConfig.introspection.endpoint = endpoint;
    } else if (existsSync(resolve('./schema.gql'))) {
      endpoint = './schema.gql';
      defaultConfig.introspection.endpoint = endpoint;
    } else {
      const { config, filepath } = await gqlessConfigPromise;

      const configIntrospectionEndpoint =
        config.introspection && config.introspection.endpoint;

      if (
        configIntrospectionEndpoint &&
        configIntrospectionEndpoint !== defaultConfig.introspection.endpoint
      ) {
        endpoint = configIntrospectionEndpoint;
      } else {
        console.error(
          '\nERROR: No introspection endpoint specified in configuration file.'
        );

        console.error(
          `\nPlease modify "${
            filepath.endsWith('package.json') ? 'gqless' : 'config'
          }.introspection.endpoint" in: "${filepath}".`
        );

        process.exit(1);
      }
    }

    if (!destination) {
      const configDestination = (await gqlessConfigPromise).config.destination;

      destination = configDestination || './src/generated/graphql.ts';
    }

    await inspectWriteGenerate({
      endpoint,
      destination,
      cli: true,
      generateOptions: {
        react,
      },
    }).catch((err) => {
      if (err instanceof Error) delete err.stack;
      console.error(err);
      process.exit(1);
    });
    process.exit(0);
  });

program.parse(process.argv);
