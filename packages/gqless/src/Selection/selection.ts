export enum SelectionType {
  Query,
  Mutation,
  Subscription,
}

export type SelectionConstructorArgs = {
  key: string | number;
  prevSelection?: Selection;
  isArray?: boolean;
  type?: SelectionType;
  alias?: string;
  args?: Record<string, unknown>;
  argTypes?: Record<string, string>;
};

export class Selection {
  key: string | number;

  isArray: boolean;
  type: SelectionType;

  args?: Record<string, unknown>;
  argTypes?: Record<string, string>;
  alias?: string;

  cachePath: (string | number)[] = [];
  pathString: string;

  selections = new Set<Selection>();
  selectionsWithoutArrayIndex: Selection[];

  constructor({
    key,
    prevSelection,
    args,
    argTypes,
    isArray = false,
    type,
    alias,
  }: SelectionConstructorArgs) {
    this.key = key;
    this.args = args;
    this.argTypes = argTypes;
    this.isArray = isArray;
    this.type = type || prevSelection?.type || SelectionType.Query;
    this.alias = alias;

    if (prevSelection) {
      for (const selection of prevSelection.selections) {
        this.selections.add(selection);
      }
      this.selections.add(this);
    } else {
      this.selections.add(this);
    }

    for (const selection of this.selections) {
      this.cachePath.push(selection.alias || selection.key);
    }
    this.pathString = this.cachePath.join('.');
    this.cachePath.splice(0, 1);

    this.selectionsWithoutArrayIndex = Array.from(this.selections).filter(
      (v) => typeof v.key === 'string'
    );
  }
}
