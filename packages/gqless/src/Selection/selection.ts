import { AliasManager } from './AliasManager';

export enum SelectionType {
  Query,
  Mutation,
  Subscription,
}

export class Selection {
  args?: Record<string, unknown>;
  argTypes?: Record<string, string>;
  key: string | number;
  selections = new Set<Selection>();
  isArray: boolean;

  type: SelectionType;

  alias?: string;
  aliasManager: AliasManager;

  path: (string | number)[];
  pathString: string;

  constructor({
    key,
    prevSelection,
    args,
    argTypes,
    isArray = false,
    aliasManager,
    type,
  }: {
    key: string | number;
    prevSelection?: Selection;
    args?: Selection['args'];
    argTypes?: Selection['argTypes'];
    isArray?: boolean;
    aliasManager: AliasManager;
    type?: SelectionType;
  }) {
    this.key = key;
    this.args = args;
    this.argTypes = argTypes;
    this.isArray = isArray;
    this.aliasManager = aliasManager;
    this.type = type || prevSelection?.type || SelectionType.Query;

    if (prevSelection) {
      for (const selection of prevSelection.selections) {
        this.selections.add(selection);
      }
      this.selections.add(this);
    } else {
      this.selections.add(this);
    }

    this.path = this.getPath();
    this.pathString = this.path.join('.');
  }

  get selectionsWithoutArrayIndex() {
    return Array.from(this.selections).filter((v) => typeof v.key === 'string');
  }

  private getPath() {
    const path: (string | number)[] = [];

    for (const selection of this.selections) {
      if (selection.args && selection.argTypes) {
        if (!selection.alias) {
          selection.alias = this.aliasManager.getVariableAlias(
            selection.args,
            selection.argTypes
          );
        }
        path.push(selection.alias);
      } else {
        path.push(selection.key);
      }
    }

    return path;
  }
}

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
