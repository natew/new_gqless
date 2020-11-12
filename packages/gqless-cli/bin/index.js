#!/usr/bin/env node

const { program } = require('commander');
const { inspectWriteGenerate } = require('../dist/index');

program.version('1.0.0').description('CLI for gqless');

program
  .command('generate <endpoint> [destination]')
  .option('--overwrite', 'Overwrite file if already exists')
  .description(
    'generate the gqless schema and client in the specified directory (./src/generated/graphql.ts by default). \nexample: "gqless-cli generate http://localhost:3000/graphql src/generated/index.ts"'
  )
  .action(
    async (endpoint, destination = './src/generated/graphql.ts', opts) => {
      await inspectWriteGenerate({
        endpoint,
        destination,
        cli: true,
        overwrite: !!opts.overwrite,
      }).catch((err) => {
        console.error(err);
        process.exit(1);
      });
      process.exit(0);
    }
  );

program.parse(process.argv);
