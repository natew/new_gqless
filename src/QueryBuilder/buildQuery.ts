import { set } from "lodash";
import { Selection } from "../Selection/selection";

interface SelectionTree extends Map<Selection, SelectionTree | true> {}

export const buildQuery = (selections: Selection[]) => {
  let variableId = 1;

  const selectionTree: SelectionTree = new Map();
  const variables: Record<string, unknown> = {};
  for (const selection of selections) {
    for (const selection2 of selection.selections) {
      if (selectionTree.has(selection2)) {
        selectionTree;
      }
    }
    set(
      selectionTree,
      Array.from(selection.selections).map((v) => {
        if (v.args && Object.keys(v.args).length) {
          return `${v.key}(${Object.entries(v.args).reduce((acum, [key, value]) => {
            const variableName = `${key}${variableId++}`;
            variables[variableName] = value;
            acum += `${key}:$${variableName}`;
            return acum;
          }, "")})`;
        }
        return v.key;
      }),
      true
    );
  }

  const selectionTreeString = JSON.stringify(selectionTree, null, 2);

  return {
    query: selectionTreeString,
    variables,
  };
};

const a = new Selection({
  key: "query",
});

const b = new Selection({
  key: "Hello",
  prevSelection: a,
});

const c = new Selection({
  key: "name",
  prevSelection: b,
  args: {
    foo: "bar",
  },
});

const d = new Selection({
  key: "other",
  prevSelection: c,
});

const e = new Selection({
  key: "zxc",
  prevSelection: c,
});

console.log(buildQuery([d, e]).query);
