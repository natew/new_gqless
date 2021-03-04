import { isPlainObject } from '../Utils';

export function getFields<
  TAccesorData extends object,
  TAccesorKeys extends keyof TAccesorData
>(accessor: TAccesorData, ...keys: TAccesorKeys[]): TAccesorData {
  if (keys.length) {
    for (const key of keys) {
      accessor[key];
    }
  } else {
    for (const key in accessor) {
      accessor[key];
    }
  }

  return accessor;
}

export function getArrayFields<
  TArray extends (object | null | undefined)[],
  TArrayValueKeys extends keyof TArray[number]
>(accessorArray: TArray, ...keys: TArrayValueKeys[]): TArray {
  for (const value of accessorArray) {
    if (isPlainObject(value)) {
      getFields(value, ...keys);
      break;
    }
  }
  return accessorArray;
}
