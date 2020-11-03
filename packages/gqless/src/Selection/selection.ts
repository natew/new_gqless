import { AliasManager } from "./AliasManager";

export class Selection {
  args?: Record<string, unknown>;
  argTypes?: Record<string, string>;
  key: string | number;
  selections = new Set<Selection>();
  isArray: boolean;

  alias?: string;
  aliasManager: AliasManager;

  constructor({
    key,
    prevSelection,
    args,
    argTypes,
    isArray = false,
    aliasManager,
  }: {
    key: string | number;
    prevSelection?: Selection;
    args?: Selection["args"];
    argTypes?: Selection["argTypes"];
    isArray?: boolean;
    aliasManager: AliasManager;
  }) {
    this.key = key;
    this.args = args;
    this.argTypes = argTypes;
    this.isArray = isArray;
    this.aliasManager = aliasManager;

    if (prevSelection) {
      for (const selection of prevSelection.selections) {
        this.selections.add(selection);
      }
      this.selections.add(this);
    } else {
      this.selections.add(this);
    }
  }

  public get selectionsWithoutArrayIndex() {
    return [...this.selections].filter((v) => typeof v.key === "string");
  }

  public get path() {
    const path: (string | number)[] = [];

    for (const selection of this.selections) {
      if (selection.args && selection.argTypes) {
        if (!selection.alias) {
          selection.alias = this.aliasManager.getVariableAlias(selection.args, selection.argTypes);
        }
        path.push(selection.alias);
      } else {
        path.push(selection.key);
      }
    }

    return path;
  }
}
