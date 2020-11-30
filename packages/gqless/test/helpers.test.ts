import { selectFields } from '../src';
import { createTestClient } from './utils';

describe('selectFields', () => {
  test('recursive *, depth 1', async () => {
    const { query, resolved } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(
        query.human({
          name: 'foo',
        })
      );
    });

    expect(data).toEqual({
      name: 'foo',
      father: null,
      nullFather: null,
      sons: [null],
    });
  });

  test('recursive *, depth 2', async () => {
    const { query, resolved } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(
        query.human({
          name: 'foo',
        }),
        '*',
        2
      );
    });

    expect(data).toEqual({
      name: 'foo',
      father: {
        name: 'default',
        father: null,
        nullFather: null,
        sons: [null],
      },
      nullFather: null,
      sons: [
        {
          name: 'default',
          father: null,
          nullFather: null,
          sons: [null],
        },
        {
          name: 'default',
          father: null,
          nullFather: null,
          sons: [null],
        },
      ],
    });
  });

  test('named no recursive', async () => {
    const { query, resolved } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(
        query.human({
          name: 'bar',
        }),
        ['name', 'father.name']
      );
    });

    expect(data).toEqual({
      name: 'bar',
      father: {
        name: 'default',
      },
    });
  });

  test('named recursive, depth 1', async () => {
    const { query, resolved } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(
        query.human({
          name: 'bar',
        }),
        ['father']
      );
    });

    expect(data).toEqual({
      father: {
        name: 'default',
        father: null,
        nullFather: null,
        sons: [null],
      },
    });
  });

  test('named recursive, depth 2', async () => {
    const { query, resolved } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(
        query.human({
          name: 'bar',
        }),
        ['father'],
        2
      );
    });

    expect(data).toEqual({
      father: {
        name: 'default',
        father: {
          name: 'default',
          father: null,
          sons: [null],
          nullFather: null,
        },
        nullFather: null,
        sons: [
          {
            name: 'default',
            father: null,
            nullFather: null,
            sons: [null],
          },
          {
            name: 'default',
            father: null,
            nullFather: null,
            sons: [null],
          },
        ],
      },
    });
  });

  test('named recursive - array', async () => {
    const { query, resolved } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(query.human().sons, ['name']);
    });

    expect(data).toEqual([
      {
        name: 'default',
      },
      {
        name: 'default',
      },
    ]);
  });

  test('recursive * - array', async () => {
    const { query, resolved } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(query.human().sons, '*');
    });

    expect(data).toEqual([
      {
        father: null,
        nullFather: null,
        sons: [null],
        name: 'default',
      },
      { father: null, nullFather: null, sons: [null], name: 'default' },
    ]);
  });

  test('empty named fields array', async () => {
    const { query, resolved } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(query.human(), []);
    });

    expect(data).toEqual({});
  });

  test('named fields array values - depth 1', async () => {
    const { query, resolved } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(query.human(), ['sons']);
    });

    expect(data).toEqual({
      sons: [
        { name: 'default', father: null, nullFather: null, sons: [null] },
        { name: 'default', father: null, nullFather: null, sons: [null] },
      ],
    });
  });

  test('named fields array values - depth 2', async () => {
    const { query, resolved } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(query.human(), ['sons'], 2);
    });

    expect(data).toEqual({
      sons: [
        {
          name: 'default',
          father: {
            name: 'default',
            father: null,
            nullFather: null,
            sons: [null],
          },
          nullFather: null,
          sons: [
            { name: 'default', father: null, nullFather: null, sons: [null] },
            { name: 'default', father: null, nullFather: null, sons: [null] },
          ],
        },
        {
          name: 'default',
          father: {
            name: 'default',
            father: null,
            nullFather: null,
            sons: [null],
          },
          nullFather: null,
          sons: [
            { name: 'default', father: null, nullFather: null, sons: [null] },
            { name: 'default', father: null, nullFather: null, sons: [null] },
          ],
        },
      ],
    });
  });

  test('named fields object values - depth 1', async () => {
    const { query, resolved } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(query.human(), ['father']);
    });

    expect(data).toEqual({
      father: { name: 'default', father: null, nullFather: null, sons: [null] },
    });
  });

  test('named fields object values - depth 2', async () => {
    const { query, resolved } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(query.human(), ['father'], 2);
    });

    expect(data).toEqual({
      father: {
        name: 'default',
        father: {
          name: 'default',
          father: null,
          nullFather: null,
          sons: [null],
        },
        nullFather: null,
        sons: [
          { name: 'default', father: null, nullFather: null, sons: [null] },
          { name: 'default', father: null, nullFather: null, sons: [null] },
        ],
      },
    });
  });

  test('named non-existent field', async () => {
    const { query, resolved } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(query.human(), ['non_existent_field']);
    });

    expect(data).toStrictEqual({});
  });

  test('null accessor', async () => {
    const { query, resolved } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(query.nullArray);
    });

    expect(data).toBe(null);
  });

  test('primitive wrong accessor', async () => {
    const { resolved } = await createTestClient();

    const data = await resolved(() => {
      return selectFields(123 as any);
    });

    expect(data).toBe(123);
  });

  test('object wrong accessor', async () => {
    const { resolved } = await createTestClient();

    const data = await resolved(() => {
      return selectFields({
        a: 1,
      });
    });

    expect(data).toStrictEqual({
      a: 1,
    });
  });
});
