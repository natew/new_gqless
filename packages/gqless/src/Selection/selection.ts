export class Selection {
  args?: Record<string, unknown>;
  argTypes?: Record<string, string>;
  key: string;
  selections = new Set<Selection>();

  constructor({
    key,
    prevSelection,
    args,
  }: {
    key: string;
    prevSelection?: Selection;
    args?: Selection["args"];
    argTypes?: Selection["argTypes"];
  }) {
    this.key = key;
    this.args = args;
    this.argTypes = this.argTypes;

    if (prevSelection) {
      for (const selection of prevSelection.selections) {
        this.selections.add(selection);
      }
      this.selections.add(this);
    } else {
      this.selections.add(this);
    }
  }
}
