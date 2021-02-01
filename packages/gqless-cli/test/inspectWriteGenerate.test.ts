import fs from 'fs';
import { createTestApp } from 'test-utils';

import { inspectWriteGenerate } from '../src/inspectWriteGenerate';
import { getTempDir } from './utils';

const { readFile, writeFile } = fs.promises;
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

let endpoint: string;
beforeAll(async () => {
  await isReady;

  endpoint = (await server.listen(0)) + '/graphql';
});

afterAll(async () => {
  server.close();
});

test('basic inspectWriteGenerate functionality', async () => {
  const tempDir = await getTempDir();

  try {
    await inspectWriteGenerate({
      endpoint,
      overwrite: true,
      destination: tempDir.clientPath,
    });

    expect(
      await readFile(tempDir.clientPath, {
        encoding: 'utf-8',
      })
    ).toMatchSnapshot('basic inspectWriteGenerate client');

    expect(
      await readFile(tempDir.schemaPath, {
        encoding: 'utf-8',
      })
    ).toMatchSnapshot('basic inspectWriteGenerate schema');
  } finally {
    await tempDir.cleanup();
  }
});

test('specify generateOptions to inspectWriteGenerate', async () => {
  const tempDir = await getTempDir();

  const shouldBeIncluded = '// This should be included';

  try {
    await inspectWriteGenerate({
      endpoint,
      overwrite: true,
      destination: tempDir.clientPath,
      generateOptions: {
        preImport: `
            ${shouldBeIncluded}
            `,
      },
    });

    const generatedFileContentClient = await readFile(tempDir.clientPath, {
      encoding: 'utf-8',
    });

    const generatedFileContentSchema = await readFile(tempDir.schemaPath, {
      encoding: 'utf-8',
    });

    expect(generatedFileContentClient).toMatchSnapshot(
      'generateOptions client'
    );
    expect(generatedFileContentSchema).toMatchSnapshot(
      'generateOptions schema'
    );

    expect(
      generatedFileContentSchema.startsWith(shouldBeIncluded)
    ).toBeTruthy();
  } finally {
    await tempDir.cleanup();
  }
});

describe('inspect headers', () => {
  let endpoint: string;

  const secretToken = 'super secret token';

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
    context: (req, _reply) => {
      if (req.headers.authorization !== secretToken) {
        throw Error('Unauthorized!');
      }
      return {};
    },
  });

  beforeAll(async () => {
    await isReady;
    endpoint = (await server.listen(0)) + '/graphql';
  });

  afterAll(async () => {
    await server.close();
  });

  test('specify headers to inspectWriteGenerate', async () => {
    const tempDir = await getTempDir();

    const shouldBeIncluded = '// This should be included';

    try {
      await inspectWriteGenerate({
        endpoint,
        overwrite: true,
        destination: tempDir.clientPath,
        headers: {
          authorization: secretToken,
        },
        generateOptions: {
          preImport: shouldBeIncluded,
        },
      });

      const generatedFileContent = await readFile(tempDir.schemaPath, {
        encoding: 'utf-8',
      });

      expect(generatedFileContent).toMatchSnapshot('specify headers');

      expect(generatedFileContent.startsWith(shouldBeIncluded)).toBeTruthy();
    } finally {
      await tempDir.cleanup();
    }
  });

  test('should throw if headers are not specified when required by server', async () => {
    const tempDir = await getTempDir({
      initClientFile: '',
    });

    try {
      await expect(
        inspectWriteGenerate({
          endpoint,
          overwrite: true,
          destination: tempDir.clientPath,
        })
      ).rejects.toEqual({
        message: 'Unauthorized!',
      });

      const generatedFileContent = await readFile(tempDir.clientPath, {
        encoding: 'utf-8',
      });

      expect(generatedFileContent).toBe('');
    } finally {
      await tempDir.cleanup();
    }
  });
});

test('should respect to not overwrite', async () => {
  const tempDir = await getTempDir();

  try {
    await writeFile(tempDir.clientPath, 'this should be kept', {
      encoding: 'utf-8',
    });

    await expect(
      inspectWriteGenerate({
        endpoint,
        overwrite: false,
        destination: tempDir.clientPath,
      })
    ).rejects.toThrow(
      `File '${tempDir.clientPath}' already exists, specify 'overwrite: true' to overwrite the existing file.`
    );

    expect(
      await readFile(tempDir.clientPath, {
        encoding: 'utf-8',
      })
    ).toBe('this should be kept');
  } finally {
    await tempDir.cleanup();
  }
});

describe('CLI behavior', () => {
  test('overwrite message', async () => {
    const tempDir = await getTempDir();

    try {
      await writeFile(tempDir.clientPath, 'this should be kept', {
        encoding: 'utf-8',
      });

      await expect(
        inspectWriteGenerate({
          endpoint,
          overwrite: false,
          destination: tempDir.clientPath,
          cli: true,
        })
      ).rejects.toThrow(
        `File '${tempDir.clientPath}' already exists, specify '--overwrite' to overwrite the existing file.`
      );

      expect(
        await readFile(tempDir.clientPath, {
          encoding: 'utf-8',
        })
      ).toBe('this should be kept');
    } finally {
      await tempDir.cleanup();
    }
  });

  test('final message', async () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    const tempDir = await getTempDir();

    try {
      await inspectWriteGenerate({
        endpoint,
        overwrite: true,
        destination: tempDir.clientPath,
        cli: true,
      });

      expect(spy).toHaveBeenCalledTimes(1);

      expect(spy).toHaveBeenLastCalledWith(
        'Code generated successfully at ' + tempDir.clientPath
      );

      expect(
        await readFile(tempDir.clientPath, {
          encoding: 'utf-8',
        })
      ).toMatchSnapshot('basic functionality with cli final messsage');

      expect(
        await readFile(tempDir.schemaPath, {
          encoding: 'utf-8',
        })
      ).toMatchSnapshot('basic functionality with cli final messsage - schema');
    } finally {
      await tempDir.cleanup();
      spy.mockRestore();
    }
  });
});
