import {
  Selection,
  SelectionType,
  AliasManager,
  separateSelectionTypes,
} from '../src/Selection';

describe('selection creation', () => {
  const aliasManager = new AliasManager();

  test('selection with manager and separating types', () => {
    const selectionA = new Selection({
      key: 'a',
      aliasManager,
      type: SelectionType.Mutation,
    });

    expect(selectionA.key).toBe('a'), expect(selectionA.alias).toBe(undefined);
    expect(selectionA.aliasManager).toBe(aliasManager);
    expect(selectionA.type).toBe(SelectionType.Mutation);
    expect(selectionA.isArray).toBe(false);

    expect(selectionA.args).toBe(undefined);
    expect(selectionA.argTypes).toBe(undefined);
    expect(selectionA.selections).toEqual(new Set([selectionA]));

    expect(selectionA.path).toEqual(['a']);
    expect(selectionA.pathString).toBe('a');

    const selectionB = new Selection({
      key: 'b',
      aliasManager,
      prevSelection: selectionA,
      isArray: true,
    });

    expect(selectionB.key).toBe('b');
    expect(selectionB.aliasManager).toBe(aliasManager);
    expect(selectionB.type).toBe(SelectionType.Mutation);
    expect(selectionB.isArray).toBe(true);

    expect(selectionB.selections).toEqual(new Set([selectionA, selectionB]));
    expect(selectionB.path).toEqual(['a', 'b']);
    expect(selectionB.pathString).toBe('a.b');

    const selectionC = new Selection({
      key: 0,
      aliasManager,
      prevSelection: selectionB,
    });

    expect(selectionC.selectionsWithoutArrayIndex).toEqual(
      Array.from(selectionB.selections)
    );

    const selectionD = new Selection({
      key: 'd',
      aliasManager,
      prevSelection: selectionC,
      args: {
        a: 1,
      },
      argTypes: {
        a: 'Int!',
      },
    });

    expect(selectionD.path).toEqual(['a', 'b', 0, 'gqlessAlias_0']);
    expect(selectionD.pathString).toBe('a.b.0.gqlessAlias_0');
    expect(selectionD.alias).toBe('gqlessAlias_0');

    const repeatSelectionD = new Selection({
      key: 'd',
      aliasManager,
      prevSelection: selectionC,
      args: {
        a: 1,
      },
      argTypes: {
        a: 'Int!',
      },
    });

    expect(repeatSelectionD.path).toEqual(['a', 'b', 0, 'gqlessAlias_0']);
    expect(repeatSelectionD.pathString).toBe('a.b.0.gqlessAlias_0');
    expect(repeatSelectionD.alias).toBe('gqlessAlias_0');

    const selectionE = new Selection({
      key: 'e',
      aliasManager,
      prevSelection: selectionD,
    });

    expect(selectionE.path).toEqual(['a', 'b', 0, 'gqlessAlias_0', 'e']);
    expect(selectionE.pathString).toBe('a.b.0.gqlessAlias_0.e');

    const selectionF = new Selection({
      key: 'f',
      aliasManager,
    });

    const selectionG = new Selection({
      key: 'g',
      aliasManager,
      type: SelectionType.Subscription,
    });

    expect(selectionF.path).toEqual(['f']);

    expect(
      separateSelectionTypes([
        selectionA,
        selectionB,
        selectionC,
        selectionD,
        selectionE,
        selectionD,
        repeatSelectionD,
        selectionF,
        selectionG,
      ])
    ).toEqual({
      querySelections: [selectionF],
      mutationSelections: [
        selectionA,
        selectionB,
        selectionC,
        selectionD,
        selectionE,
        selectionD,
        repeatSelectionD,
      ],
      subscriptionSelections: [selectionG],
    });
  });
});
