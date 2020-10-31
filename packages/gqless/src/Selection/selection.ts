import { ArrayField } from "../Cache";

export class Selection {
  args?: Record<string, unknown>;
  argTypes?: Record<string, string>;
  key: string;
  selections = new Set<Selection>();
  isArray: boolean;

  constructor({
    key,
    prevSelection,
    args,
    isArray = false,
  }: {
    key: string;
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

  public get path() {
    const path: string[] = [];

    for (const selection of this.selections) {
      path.push(selection.key);
    }

    return path;
  }

  public get pathArray() {
    const path: Array<typeof ArrayField | string> = [];

    for (const selection of this.selections) {
      if (selection.isArray) {
        path.push(ArrayField);
      } else {
        path.push(selection.key);
      }
    }

    return path;
  }
}
