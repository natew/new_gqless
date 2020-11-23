import {
  SelectionManager,
  SelectionType,
  separateSelectionTypes,
} from '../src/Selection';

describe('selection creation', () => {
  const manager = new SelectionManager();

  test('selection with manager and separating types', () => {
    const allowCache = true;
    const selectionA = manager.getSelection({
      key: 'a',
      type: SelectionType.Mutation,
      allowCache,
    });

    expect(selectionA.key).toBe('a'), expect(selectionA.alias).toBe(undefined);
    expect(selectionA.type).toBe(SelectionType.Mutation);

    expect(selectionA.args).toBe(undefined);
    expect(selectionA.argTypes).toBe(undefined);
    expect(selectionA.noIndexSelections).toEqual([selectionA]);

    expect(selectionA.cachePath).toEqual(['a']);
    expect(selectionA.pathString).toBe('a');

    const selectionB = manager.getSelection({
      key: 'b',
      prevSelection: selectionA,
      allowCache,
    });

    expect(selectionB.key).toBe('b');
    expect(selectionB.type).toBe(SelectionType.Mutation);

    expect(selectionB.noIndexSelections).toEqual([selectionA, selectionB]);
    expect(selectionB.cachePath).toEqual(['a', 'b']);
    expect(selectionB.pathString).toBe('a.b');

    const selectionC = manager.getSelection({
      key: 0,
      prevSelection: selectionB,
      allowCache,
    });

    expect(selectionC.noIndexSelections).toEqual(selectionB.noIndexSelections);

    const selectionD = manager.getSelection({
      key: 'd',
      prevSelection: selectionC,
      args: {
        a: 1,
      },
      argTypes: {
        a: 'Int!',
      },
      allowCache,
    });

    expect(selectionD.cachePath).toEqual(['a', 'b', 0, 'gqlessAlias_0']);
    expect(selectionD.pathString).toBe('a.b.0.gqlessAlias_0');
    expect(selectionD.alias).toBe('gqlessAlias_0');

    const repeatSelectionD = manager.getSelection({
      key: 'd',
      prevSelection: selectionC,
      args: {
        a: 1,
      },
      argTypes: {
        a: 'Int!',
      },
      allowCache,
    });

    expect(repeatSelectionD.cachePath).toEqual(['a', 'b', 0, 'gqlessAlias_0']);
    expect(repeatSelectionD.pathString).toBe('a.b.0.gqlessAlias_0');
    expect(repeatSelectionD.alias).toBe('gqlessAlias_0');

    const selectionE = manager.getSelection({
      key: 'e',
      prevSelection: selectionD,
      allowCache,
    });

    expect(selectionE.cachePath).toEqual(['a', 'b', 0, 'gqlessAlias_0', 'e']);
    expect(selectionE.pathString).toBe('a.b.0.gqlessAlias_0.e');

    const selectionF = manager.getSelection({
      key: 'f',
      allowCache,
    });

    const selectionG = manager.getSelection({
      key: 'g',
      type: SelectionType.Subscription,
      allowCache,
    });

    expect(selectionF.cachePath).toEqual(['f']);
    expect(selectionF.pathString).toBe('f');

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

  test('selections with manager ignoring cache', () => {
    const z1 = manager.getSelection({
      key: 'zz',
      allowCache: false,
    });

    const z2 = manager.getSelection({
      key: 'zz',
      allowCache: true,
    });

    expect(z1).not.toBe(z2);

    expect(z1).toStrictEqual(z2);
  });
});
