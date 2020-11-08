import fs from 'fs';
import { createTestApp } from 'test-utils';
import tmp from 'tmp-promise';

import { inspectWriteGenerate } from '../src/inspectWriteGenerate';

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
  const tempFile = await tmp.file();

  try {
    await inspectWriteGenerate({
      endpoint,
      overwrite: true,
      destination: tempFile.path,
    });

    expect(
      await readFile(tempFile.path, {
        encoding: 'utf-8',
      })
    ).toMatchSnapshot('basic inspectWriteGenerate');
  } finally {
    await tempFile.cleanup();
  }
});

test('specify generateOptions to inspectWriteGenerate', async () => {
  const tempFile = await tmp.file();

  const shouldBeIncluded = '// This should be included';

  try {
    await inspectWriteGenerate({
      endpoint,
      overwrite: true,
      destination: tempFile.path,
      generateOptions: {
        preImport: `
            ${shouldBeIncluded}
            `,
      },
    });

    const generatedFileContent = await readFile(tempFile.path, {
      encoding: 'utf-8',
    });

    expect(generatedFileContent).toMatchSnapshot('generateOptions');

    expect(generatedFileContent.startsWith(shouldBeIncluded)).toBeTruthy();
  } finally {
    await tempFile.cleanup();
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
    const tempFile = await tmp.file();

    const shouldBeIncluded = '// This should be included';

    try {
      await inspectWriteGenerate({
        endpoint,
        overwrite: true,
        destination: tempFile.path,
        headers: {
          authorization: secretToken,
        },
        generateOptions: {
          preImport: shouldBeIncluded,
        },
      });

      const generatedFileContent = await readFile(tempFile.path, {
        encoding: 'utf-8',
      });

      expect(generatedFileContent).toMatchSnapshot('specify headers');

      expect(generatedFileContent.startsWith(shouldBeIncluded)).toBeTruthy();
    } finally {
      await tempFile.cleanup();
    }
  });

  test('should throw if headers are not specified when required by server', async () => {
    const tempFile = await tmp.file();

    try {
      await expect(
        inspectWriteGenerate({
          endpoint,
          overwrite: true,
          destination: tempFile.path,
        })
      ).rejects.toEqual({
        message: 'Unauthorized!',
      });

      const generatedFileContent = await readFile(tempFile.path, {
        encoding: 'utf-8',
      });

      expect(generatedFileContent).toBe('');
    } finally {
      await tempFile.cleanup();
    }
  });
});

test('should respect to not overwrite', async () => {
  const tempFile = await tmp.file();

  try {
    await writeFile(tempFile.path, 'this should be kept', {
      encoding: 'utf-8',
    });

    await expect(
      inspectWriteGenerate({
        endpoint,
        overwrite: false,
        destination: tempFile.path,
      })
    ).rejects.toThrow(
      `File '${tempFile.path}' already exists, specify 'overwrite: true' to overwrite the existing file.`
    );

    expect(
      await readFile(tempFile.path, {
        encoding: 'utf-8',
      })
    ).toBe('this should be kept');
  } finally {
    await tempFile.cleanup();
  }
});

describe('CLI behavior', () => {
  test('overwrite message', async () => {
    const tempFile = await tmp.file();

    try {
      await writeFile(tempFile.path, 'this should be kept', {
        encoding: 'utf-8',
      });

      await expect(
        inspectWriteGenerate({
          endpoint,
          overwrite: false,
          destination: tempFile.path,
          cli: true,
        })
      ).rejects.toThrow(
        `File '${tempFile.path}' already exists, specify '--overwrite' to overwrite the existing file.`
      );

      expect(
        await readFile(tempFile.path, {
          encoding: 'utf-8',
        })
      ).toBe('this should be kept');
    } finally {
      await tempFile.cleanup();
    }
  });

  test('final message', async () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    const tempFile = await tmp.file();

    try {
      await inspectWriteGenerate({
        endpoint,
        overwrite: true,
        destination: tempFile.path,
        cli: true,
      });

      expect(spy).toHaveBeenCalledTimes(1);

      expect(spy).toHaveBeenLastCalledWith(
        'Code generated successfully at ' + tempFile.path
      );

      expect(
        await readFile(tempFile.path, {
          encoding: 'utf-8',
        })
      ).toMatchSnapshot('basic functionality with cli final messsage');
    } finally {
      await tempFile.cleanup();
      spy.mockRestore();
    }
  });
});
