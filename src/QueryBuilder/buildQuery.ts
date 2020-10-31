import { stripIgnoredCharacters } from "graphql/utilities/stripIgnoredCharacters";
import { set } from "lodash";

import { Selection } from "../Selection/selection";

interface SelectionTree {
  [P: string]: SelectionTree | true;
}

const stringSelectionTree = (v: SelectionTree, depth = 0) => {
  const spaceDepth = "  ".repeat(depth);
  const treeEntries = Object.entries(v);
  return treeEntries.reduce((acum, [key, value], index) => {
    if (typeof value === "object") {
      acum += `${spaceDepth}${key} {\n`;

      acum += stringSelectionTree(value, depth + 1);

      acum += `${spaceDepth}\n${spaceDepth}}${spaceDepth}`;
    } else {
      acum += `${index === treeEntries.length - 1 ? "\n" : ""}${spaceDepth}${key}`;
    }
    return acum;
  }, "");
};

export const buildQuery = (selections: Selection[], strip?: boolean) => {
  let variableId = 1;

  const selectionTree: SelectionTree = {};
  const variablesMap = new Map<unknown, string>();
  for (const selection of selections) {
    set(
      selectionTree,
      Array.from(selection.selections).map((v) => {
        const argsLength = v.args ? Object.keys(v.args).length : 0;
        if (v.args && argsLength) {
          return `${v.key}(${Object.entries(v.args).reduce((acum, [key, value], index) => {
            const variableMapValue = variablesMap.get(value);
            if (variableMapValue) {
              acum += `${key}:$${variableMapValue}`;
            } else {
              const newVariableValue = `${key}${variableId++}`;
              variablesMap.set(value, newVariableValue);
              acum += `${key}:$${newVariableValue}`;
            }
            if (index < argsLength - 1) {
              acum += ",";
            }

            return acum;
          }, "")})`;
        }
        return v.key;
      }),
      true
    );
  }

  let variables: Record<string, unknown> | undefined;

  if (variablesMap.size) {
    const variablesObj: Record<string, unknown> = {};
    variables = variablesObj;

    variablesMap.forEach((value, key) => {
      variablesObj[value] = key;
    });
  }

  const query = stringSelectionTree(selectionTree);

  return {
    query: strip ? stripIgnoredCharacters(query) : query,
    variables,
  };
};

const a = new Selection({
  key: "query",
});

const b = new Selection({
  key: "Hello",
  prevSelection: a,
  args: {
    deepObject: {
      a: {
        b: {
          c: 2,
        },
      },
    },
  },
});

const c = new Selection({
  key: "name",
  prevSelection: b,
  args: {
    foo: "bar",
    otherArg: "hello",
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

const query = buildQuery([d, e]);
console.log(query.query, "\nvariables:", JSON.stringify(query.variables, null, 2));
