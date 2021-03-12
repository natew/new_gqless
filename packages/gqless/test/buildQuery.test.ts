import {
  parse,
  stripIgnoredCharacters as officialStripIgnoredCharacters,
} from 'graphql';

import { buildQuery } from '../src/QueryBuilder';
import { Selection, SelectionType } from '../src/Selection';

describe('basic', () => {
  test('query', () => {
    const baseSelection = new Selection({
      key: 'query',
      type: SelectionType.Query,
    });

    const selectionA = new Selection({
      key: 'a',
      prevSelection: baseSelection,
    });

    const selectionB = new Selection({
      key: 'b',
      prevSelection: baseSelection,
    });

    const { query, variables } = buildQuery([selectionA, selectionB], {
      type: 'query',
    });

    expect(query.trim().startsWith('query{')).toBeTruthy();

    expect(query).toMatchSnapshot('basic query');

    expect(variables).toBe(undefined);

    expect(() => {
      parse(query);
    }).not.toThrow();

    expect(officialStripIgnoredCharacters(query)).toBe(query);
  });

  test('deep query with unions', () => {
    const baseSelection = new Selection({
      key: 'query',
      type: SelectionType.Query,
    });

    const selectionA = new Selection({
      key: 'a',
      prevSelection: baseSelection,
    });

    const selectionB = new Selection({
      key: 'b',
      prevSelection: selectionA,
    });

    const selectionC = new Selection({
      key: 'c',
      prevSelection: selectionB,
    });

    const selectionD = new Selection({
      key: 'd',
      prevSelection: selectionC,
    });

    const selectionE1 = new Selection({
      key: 'a',
      prevSelection: selectionD,
      unions: ['val1', 'val2'],
    });

    const selectionE2 = new Selection({
      key: 'b',
      prevSelection: selectionD,
      unions: ['val1'],
    });

    const selectionF = new Selection({
      key: 'f',
      prevSelection: selectionE1,
    });

    const { query, variables } = buildQuery([selectionE2, selectionF], {
      type: 'query',
    });

    expect(query.trim().startsWith('query{')).toBeTruthy();

    expect(query).toMatchSnapshot('basic query');

    expect(variables).toBe(undefined);

    expect(() => {
      parse(query);
    }).not.toThrow();

    expect(officialStripIgnoredCharacters(query)).toBe(query);
  });

  test('query args', () => {
    const baseSelection = new Selection({
      key: 'query',
      type: SelectionType.Query,
    });

    const selectionA = new Selection({
      key: 'a',
      prevSelection: baseSelection,
      args: {
        a: 1,
        b: 1,
      },
      argTypes: {
        a: 'Int!',
        b: 'String!',
      },
      alias: 'gqlessAlias_1',
    });

    const selectionB = new Selection({
      key: 'a_b',
      prevSelection: selectionA,
    });

    const selectionC = new Selection({
      key: 'a_c',
      prevSelection: selectionA,
    });

    const selectionD = new Selection({
      key: 'd',
      prevSelection: baseSelection,
    });

    const { query, variables } = buildQuery(
      [selectionB, selectionC, selectionD],
      {
        type: 'query',
      }
    );

    expect(query.trim().startsWith('query(')).toBeTruthy();

    expect(query).toMatchSnapshot('basic query args');

    expect(() => {
      parse(query);
    }).not.toThrow();

    expect(variables).toEqual({ a1: 1, b2: 1 });

    expect(officialStripIgnoredCharacters(query)).toBe(query);
  });

  test('mutation args', () => {
    const baseSelection = new Selection({
      key: 'mutation',
      type: SelectionType.Mutation,
    });

    const selectionA = new Selection({
      key: 'a',
      prevSelection: baseSelection,
      args: {
        a: 1,
        b: 1,
      },
      argTypes: {
        a: 'Int!',
        b: 'String!',
      },
      alias: 'gqlessAlias_1',
    });

    const { query, variables } = buildQuery([selectionA], {
      type: 'mutation',
    });

    expect(query.trim().startsWith('mutation(')).toBeTruthy();

    expect(query).toMatchSnapshot('basic mutation with args');

    expect(() => {
      parse(query);
    }).not.toThrow();

    expect(variables).toEqual({ a1: 1, b2: 1 });

    expect(officialStripIgnoredCharacters(query)).toBe(query);
  });
});
