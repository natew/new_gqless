import fs from 'fs';
import { createTestApp } from 'test-utils';
import tmp from 'tmp-promise';

import { writeGenerate } from '../src/writeGenerate';

const { readFile } = fs.promises;
const { server, isReady } = createTestApp({
  schema: `
    type Query {
        hello: String!
    }
    `,
  resolvers: {
    Query: {
      hello() {
        return 'hello world';
      },
    },
  },
});

beforeAll(async () => {
  await isReady;
});

test('works', async () => {
  const tempFile = await tmp.file();

  const shouldBeIncluded = '// This should be included';
  try {
    const destinationPath = await writeGenerate(
      server.graphql.schema,
      tempFile.path,
      {
        preImport: shouldBeIncluded,
      }
    );

    const generatedContent = await readFile(destinationPath, {
      encoding: 'utf-8',
    });

    expect(generatedContent.startsWith(shouldBeIncluded)).toBeTruthy();

    expect(generatedContent).toMatchSnapshot('basic');
  } finally {
    await tempFile.cleanup();
  }
});
