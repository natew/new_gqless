export class Selection {
  args?: Record<string, unknown>;
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
  }) {
    this.key = key;
    this.args = args;

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
