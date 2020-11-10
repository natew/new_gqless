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

  path: (string | number)[] = [];
  pathString: string;

  selectionsWithoutArrayIndex: Selection[];

  constructor({
    key,
    prevSelection,
    args,
    argTypes,
    isArray = false,
    type,
    alias,
  }: {
    key: string | number;
    prevSelection?: Selection;
    args?: Selection['args'];
    argTypes?: Selection['argTypes'];
    isArray?: boolean;
    type?: SelectionType;
    alias?: string;
  }) {
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
      this.path.push(selection.alias || selection.key);
    }
    this.pathString = this.path.join('.');

    this.selectionsWithoutArrayIndex = Array.from(this.selections).filter(
      (v) => typeof v.key === 'string'
    );
  }
}
