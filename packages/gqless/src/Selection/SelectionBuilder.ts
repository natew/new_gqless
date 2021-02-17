import { InnerClientState } from '../Client/client';
import { gqlessError } from '../Error';
import { parseSchemaType, Type } from '../Schema/types';
import { isInteger } from '../Utils';
import { SelectionType } from './selection';

export type BuildSelectionValue =
  | (string | number)
  | [string | number, { args?: Record<string, unknown>; unions?: string[] }?];

export type BuildSelectionInput = [
  'query' | 'mutation' | 'subscription',
  ...BuildSelectionValue[]
];

export function createSelectionBuilder(innerState: InnerClientState) {
  const { selectionManager, schema, scalarsEnumsHash } = innerState;

  function buildSelection(...[typeInput, ...input]: BuildSelectionInput) {
    let type: SelectionType;
    switch (typeInput) {
      case 'subscription': {
        type = SelectionType.Subscription;
        break;
      }
      case 'mutation': {
        type = SelectionType.Mutation;
        break;
      }
      case 'query': {
        type = SelectionType.Query;
        break;
      }
      default:
        throw new gqlessError(
          'Invalid initial selection build argument, specify "query", "mutation" or "subscription"',
          {
            caller: buildSelection,
          }
        );
    }

    let prevSelection = selectionManager.getSelection({
      key: typeInput,
      type,
    });

    let isArraySelection = false;
    let schemaType = schema[typeInput];

    for (const [index, inputValue] of input.entries()) {
      let key: string | number;
      let args: Record<string, unknown> | undefined;
      let unions: string[] | undefined;
      if (typeof inputValue !== 'object') {
        key = inputValue;
      } else {
        key = inputValue[0];
        args = inputValue[1]?.args;
        unions = inputValue[1]?.unions;
      }

      if (isArraySelection) {
        let arrayIndex: number | undefined;
        try {
          arrayIndex = parseInt(key as string);
        } catch (err) {}

        if (isInteger(arrayIndex)) {
          prevSelection = selectionManager.getSelection({
            key,
            prevSelection,
          });

          isArraySelection = false;
          continue;
        } else {
          prevSelection = selectionManager.getSelection({
            key: 0,
            prevSelection,
          });
        }
      }

      const schemaTypeValue = schemaType[key] as Type | undefined;
      if (!schemaTypeValue)
        throw new gqlessError(
          `Invalid selection argument at index ${index + 1}: ${JSON.stringify(
            key
          )}, possible valid keys: ${Object.keys(schemaType)
            .map((v) => `"${v}"`)
            .join(' | ')}`,
          {
            caller: buildSelection,
          }
        );

      const { __type, __args: argTypes } = schemaTypeValue;
      const { pureType, isArray } = parseSchemaType(__type);

      isArraySelection = isArray;

      prevSelection = selectionManager.getSelection({
        key,
        prevSelection,
        args: argTypes ? args || {} : args,
        argTypes,
        unions,
      });

      if (scalarsEnumsHash[pureType]) continue;

      // TODO: Support unions
      const typeValue = schema[pureType] as Record<string, Type> | undefined;
      if (!typeValue)
        throw new gqlessError('Invalid schema type', {
          caller: buildSelection,
        });

      schemaType = typeValue;
    }

    return prevSelection;
  }

  return {
    buildSelection,
  };
}
