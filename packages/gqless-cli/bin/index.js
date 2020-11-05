#!/usr/bin/env node

const { program } = require('commander');
const { getRemoteSchema, writeGenerate } = require('../dist/index');
const fs = require('fs');
const { resolve } = require('path');

program.version('1.0.0').description('CLI for gqless');

program
  .command('generate <source> [destination]')
  .option('--overwrite', 'Overwrite file if already exists')
  .description(
    'generate the gqless schema and client in the specified directory (./graphql/generated/index.ts by default)'
  )
  .action(
    async (source, destination = './graphql/generated/index.ts', opts) => {
      const destinationPath = resolve(destination);

      if (!opts.overwrite && fs.existsSync(destinationPath)) {
        console.log(
          "File already exists, specify '--overwrite' to overwrite the existing file."
        );
        process.exit(0);
      }

      const schema = await getRemoteSchema(source);

      await writeGenerate(schema, destinationPath);

      console.log('Code generated successfully at ' + destinationPath);
      process.exit(0);
    }
  );

program.parse(process.argv);
