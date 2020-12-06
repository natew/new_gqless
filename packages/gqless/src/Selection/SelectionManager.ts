import {
  Selection,
  SelectionConstructorArgs,
  SelectionType,
} from './selection';

export function separateSelectionTypes(
  selections: Selection[] | Set<Selection>
) {
  const querySelections: Selection[] = [];
  const mutationSelections: Selection[] = [];
  const subscriptionSelections: Selection[] = [];

  for (const selection of selections) {
    switch (selection.type) {
      case SelectionType.Query: {
        querySelections.push(selection);
        break;
      }
      case SelectionType.Mutation: {
        mutationSelections.push(selection);
        break;
      }
      case SelectionType.Subscription: {
        subscriptionSelections.push(selection);
        break;
      }
    }
  }

  return {
    querySelections,
    mutationSelections,
    subscriptionSelections,
  };
}

export type SelectionManager = ReturnType<typeof createSelectionManager>;

export function createSelectionManager() {
  const selectionCache = new Map<string, Selection>();

  const incIds: Record<string, number> = {};
  const aliasMap = new Map<string, string>();

  function getVariableAlias(
    key: string | number,
    variables: Record<string, unknown>,
    variableTypes: Record<string, string>
  ) {
    const aliasKey = `${key}-${JSON.stringify(variables)}-${JSON.stringify(
      variableTypes
    )}`;
    let alias = aliasMap.get(aliasKey);

    if (alias == null) {
      if (incIds[key] === undefined) incIds[key] = 0;
      alias = `${key}${incIds[key]++}`;
      aliasMap.set(aliasKey, alias);
    }

    return alias;
  }

  function getSelection({
    key,
    prevSelection,
    args,
    argTypes,
    type,
  }: Pick<
    SelectionConstructorArgs,
    'key' | 'prevSelection' | 'args' | 'argTypes' | 'type'
  >) {
    let alias: string | undefined;
    let cacheKey = key.toString();
    if (args && argTypes) {
      alias = getVariableAlias(key, args, argTypes);
      cacheKey = alias;
    }

    if (prevSelection) {
      cacheKey = prevSelection.pathString + '.' + cacheKey;
    }

    let selection = selectionCache.get(cacheKey);

    if (selection == null) {
      selection = new Selection({
        key,
        prevSelection,
        args,
        argTypes,
        alias,
        type,
      });
      selectionCache.set(cacheKey, selection);
    }

    return selection;
  }

  return {
    getSelection,
  };
}
