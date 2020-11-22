import fs from 'fs';
import path from 'path';
import { createTestApp } from 'test-utils';
import tmp from 'tmp-promise';

import { writeGenerate } from '../src/writeGenerate';

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

test('generates code and writes existing file', async () => {
  const tempFile = await tmp.file();

  try {
    const shouldBeIncluded = '// This should be included';

    const firstStats = await fs.promises.stat(tempFile.path);

    const destinationPath = await writeGenerate(
      server.graphql.schema,
      tempFile.path,
      {
        preImport: shouldBeIncluded,
      }
    );

    const secondStats = await fs.promises.stat(tempFile.path);

    expect(secondStats.mtimeMs).toBeGreaterThan(firstStats.mtimeMs);

    // If the code didn't change, it shouldn't write anything
    await writeGenerate(server.graphql.schema, tempFile.path, {
      preImport: shouldBeIncluded,
    });

    const thirdStats = await fs.promises.stat(tempFile.path);

    expect(secondStats.mtimeMs).toBe(thirdStats.mtimeMs);

    const generatedContent = await fs.promises.readFile(destinationPath, {
      encoding: 'utf-8',
    });

    expect(generatedContent.startsWith(shouldBeIncluded)).toBeTruthy();

    expect(generatedContent).toMatchSnapshot('overwrite');
  } finally {
    await tempFile.cleanup();
  }
});

test('creates dir, generates code and writes new file', async () => {
  const tempDir = await tmp.dir({
    unsafeCleanup: true,
  });

  try {
    const targetPath = path.join(tempDir.path, '/new_path/file-to-generate.ts');

    const shouldBeIncluded = '// This should be included';

    const destinationPath = await writeGenerate(
      server.graphql.schema,
      targetPath,
      {
        preImport: shouldBeIncluded,
      }
    );

    const generatedContent = await fs.promises.readFile(destinationPath, {
      encoding: 'utf-8',
    });

    expect(generatedContent.startsWith(shouldBeIncluded)).toBeTruthy();

    expect(generatedContent).toMatchSnapshot('new');
  } finally {
    await tempDir.cleanup();
  }
});
