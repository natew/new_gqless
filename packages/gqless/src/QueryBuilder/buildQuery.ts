import { Selection } from '../Selection';
import { set } from '../Utils';

interface SelectionTree {
  [P: string]: SelectionTree | true;
}

const stringSelectionTree = (v: SelectionTree) => {
  const treeEntries = Object.entries(v);
  return treeEntries.reduce((acum, [key, value], index) => {
    if (typeof value === 'object') {
      acum += `${key}{`;

      acum += stringSelectionTree(value);

      acum += `}`;
    } else {
      acum += `${key}` + (index !== treeEntries.length - 1 ? ' ' : '');
    }
    return acum;
  }, '');
};

export const buildQuery = (
  selections: Set<Selection> | Selection[],
  {
    type,
  }: {
    type: 'query' | 'mutation' | 'subscription';
  },
  normalization?: boolean
) => {
  let variableId = 1;

  const selectionTree: SelectionTree = {};
  const variablesMap = new Map<string, string>();
  const variableTypes: Record<string, string> = {};
  const variablesMapKeyValue: Record<string, unknown> = {};

  for (const selection of selections) {
    const selectionBranches: string[][] = [];

    function createSelectionBranch(
      selections: readonly Selection[],
      initialValue: string[] = []
    ) {
      return selections.reduce((acum, selectionValue, index) => {
        const argsLength = selectionValue.args
          ? Object.keys(selectionValue.args).length
          : 0;

        const selectionKey = selectionValue.alias
          ? `${selectionValue.alias}:${selectionValue.key}`
          : selectionValue.key;

        let leafValue: string;

        if (selectionValue.args && selectionValue.argTypes && argsLength) {
          leafValue = `${selectionKey}(${Object.entries(
            selectionValue.args
          ).reduce((acum, [key, value], index) => {
            const variableMapKey = `${
              selectionValue.argTypes![key]
            }-${key}-${JSON.stringify(value)}`;

            variablesMapKeyValue[variableMapKey] = value;

            const variableMapValue = variablesMap.get(variableMapKey);

            if (variableMapValue) {
              acum += `${key}:$${variableMapValue}`;
            } else {
              const newVariableValue = `${key}${variableId++}`;
              const newVariableType = selectionValue.argTypes![key];

              variableTypes[newVariableValue] = newVariableType;
              variablesMap.set(variableMapKey, newVariableValue);

              acum += `${key}:$${newVariableValue}`;
            }

            if (index < argsLength - 1) {
              acum += ' ';
            }

            return acum;
          }, '')})`;
        } else {
          leafValue = selectionKey + '';
        }

        const selectionUnions = selectionValue.unions;

        if (selectionUnions) {
          for (const union of selectionUnions.slice(1)) {
            const newAcum = [...acum, `...on ${union}`, leafValue];

            selectionBranches.push(
              createSelectionBranch(selections.slice(index + 1), newAcum)
            );
          }

          acum.push(`...on ${selectionUnions[0]}`, leafValue);
        } else {
          acum.push(leafValue);
        }

        return acum;
      }, initialValue);
    }

    selectionBranches.push(createSelectionBranch(selection.noIndexSelections));

    for (const branch of selectionBranches) {
      if (normalization) {
        for (let i = 2; i < branch.length; ++i) {
          const typenameBranch = branch.slice(0, i);
          if (typenameBranch[typenameBranch.length - 1]?.startsWith('...')) {
            continue;
          } else typenameBranch.push('__typename');

          set(selectionTree, typenameBranch, true);
        }
      }

      set(selectionTree, branch, true);
    }
  }

  let variables: Record<string, unknown> | undefined;

  if (variablesMap.size) {
    const variablesObj: Record<string, unknown> = {};
    variables = variablesObj;

    variablesMap.forEach((value, key) => {
      variablesObj[value] = variablesMapKeyValue[key];
    });
  }

  let query = stringSelectionTree(selectionTree);

  const variableTypesEntries = Object.entries(variableTypes);

  if (variableTypesEntries.length) {
    query = query.replace(
      type,
      `${type}(${variableTypesEntries.reduce((acum, [variableName, type]) => {
        acum += `$${variableName}:${type}`;
        return acum;
      }, '')})`
    );
  }

  return {
    query,
    variables,
  };
};
