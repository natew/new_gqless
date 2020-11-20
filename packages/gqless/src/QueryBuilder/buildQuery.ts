import { stripIgnoredCharacters } from 'graphql/utilities/stripIgnoredCharacters';
import lodashSet from 'lodash/set';

import { Selection } from '../Selection';

interface SelectionTree {
  [P: string]: SelectionTree | true;
}

const stringSelectionTree = (v: SelectionTree, depth = 0) => {
  const spaceDepth = '  '.repeat(depth);
  const treeEntries = Object.entries(v);
  return treeEntries.reduce((acum, [key, value]) => {
    if (typeof value === 'object') {
      acum += `${spaceDepth}${key} {`;

      acum += stringSelectionTree(value, depth + 1);

      acum += `${spaceDepth}\n${spaceDepth}}${spaceDepth}`;
    } else {
      acum += `\n${spaceDepth}${key}`;
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
  }
) => {
  let variableId = 1;

  const selectionTree: SelectionTree = {};
  const variablesMap = new Map<string, string>();
  const variableTypes: Record<string, string> = {};
  const variablesMapKeyValue: Record<string, unknown> = {};

  for (const selection of selections) {
    lodashSet(
      selectionTree,
      selection.selectionsWithoutArrayIndex.map((selectionValue) => {
        const argsLength = selectionValue.args
          ? Object.keys(selectionValue.args).length
          : 0;

        const selectionKey = selectionValue.alias
          ? `${selectionValue.alias}: ${selectionValue.key}`
          : selectionValue.key;

        if (selectionValue.args && selectionValue.argTypes && argsLength) {
          return `${selectionKey}(${Object.entries(selectionValue.args).reduce(
            (acum, [key, value], index) => {
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
                acum += ',';
              }

              return acum;
            },
            ''
          )})`;
        }

        return selectionKey;
      }),
      true
    );
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
      `${type}(${variableTypesEntries.reduce(
        (acum, [variableName, type], index) => {
          acum += `$${variableName}:${type}`;
          if (index !== variableTypesEntries.length - 1) {
            acum += ',';
          }
          return acum;
        },
        ''
      )})`
    );
  }

  query = stripIgnoredCharacters(query);

  return {
    query,
    variables,
  };
};
