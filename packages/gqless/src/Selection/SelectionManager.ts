import {
  Selection,
  SelectionType,
  SelectionConstructorArgs,
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

export class SelectionManager {
  selectionCache = new Map<string, Selection>();

  incId = 0;
  aliasMap = new Map<string, string>();

  getVariableAlias(
    key: string | number,
    variables: Record<string, unknown>,
    variableTypes: Record<string, string>
  ) {
    const aliasKey = `${key}-${JSON.stringify(variables)}-${JSON.stringify(
      variableTypes
    )}`;
    let alias = this.aliasMap.get(aliasKey);

    if (alias == null) {
      alias = `gqlessAlias_${this.incId++}`;
      this.aliasMap.set(aliasKey, alias);
    }

    return alias;
  }

  getSelection({
    key,
    prevSelection,
    args,
    argTypes,
    type,
  }: SelectionConstructorArgs) {
    let alias: string | undefined;
    let cacheKey = key.toString();
    if (args && argTypes) {
      alias = this.getVariableAlias(key, args, argTypes);
      cacheKey = alias;
    }

    if (prevSelection) {
      cacheKey = prevSelection.pathString + '.' + cacheKey;
    }

    let selection = this.selectionCache.get(cacheKey);

    if (selection == null) {
      selection = new Selection({
        key,
        prevSelection,
        args,
        argTypes,
        alias,
        type,
      });
      this.selectionCache.set(cacheKey, selection);
    }

    return selection;
  }
}
