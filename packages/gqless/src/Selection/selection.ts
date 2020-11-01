export class Selection {
  args?: Record<string, unknown>;
  argTypes?: Record<string, string>;
  key: string | number;
  selections = new Set<Selection>();
  isArray: boolean;

  constructor({
    key,
    prevSelection,
    args,
    isArray = false,
  }: {
    key: string | number;
    prevSelection?: Selection;
    args?: Selection["args"];
    argTypes?: Selection["argTypes"];
    isArray?: boolean;
  }) {
    this.key = key;
    this.args = args;
    this.argTypes = this.argTypes;
    this.isArray = isArray;

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
      path.push(selection.key);
    }

    return path;
  }
}
