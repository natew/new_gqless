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

export const buildQuery = (selections: Set<Selection> | Selection[], strip?: boolean) => {
  let variableId = 1;

  const selectionTree: SelectionTree = {};
  const variablesMap = new Map<unknown, string>();
  const variableTypes: Record<string, string> = {};

  for (const selection of selections) {
    set(
      selectionTree,
      Array.from(selection.selections).map((selectionValue) => {
        const argsLength = selectionValue.args ? Object.keys(selectionValue.args).length : 0;
        if (selectionValue.args && argsLength) {
          return `${selectionValue.key}(${Object.entries(selectionValue.args).reduce(
            (acum, [key, value], index) => {
              const variableMapValue = variablesMap.get(value);
              if (variableMapValue) {
                acum += `${key}:$${variableMapValue}`;
              } else {
                const newVariableValue = `${key}${variableId++}`;
                const newVariableType = selectionValue.argTypes?.[key];
                if (newVariableType) {
                  variableTypes[newVariableValue] = newVariableType;
                }

                variablesMap.set(value, newVariableValue);
                acum += `${key}:$${newVariableValue}`;
              }
              if (index < argsLength - 1) {
                acum += ",";
              }

              return acum;
            },
            ""
          )})`;
        }
        return selectionValue.key;
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

  let query = stringSelectionTree(selectionTree);

  const variableTypesEntries = Object.entries(variableTypes);

  if (variableTypesEntries.length) {
    query = query.replace(
      "query",
      `query(${variableTypesEntries.reduce((acum, [variableName, type], index) => {
        acum += `$${variableName}:${type}`;
        if (index !== variableTypesEntries.length - 1) {
          acum += ",";
        }
        return acum;
      }, "")})`
    );
  }

  if (strip) {
    query = stripIgnoredCharacters(query);
  }

  return {
    query,
    variables,
  };
};
