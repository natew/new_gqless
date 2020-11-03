import { Selection } from "../Selection";

export class Interceptor {
  selections = new Set<Selection>();

  addSelection(selection: Selection) {
    this.selections.add(selection);
  }

  removeSelections(selections: Set<Selection> | Selection[]) {
    for (const selection of selections) {
      this.selections.delete(selection);
    }
  }
}
