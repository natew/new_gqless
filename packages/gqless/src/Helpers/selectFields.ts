import lodashGet from 'lodash/get';
import lodashSet from 'lodash/set';

import { CacheNotFound } from '../Cache';
import { isObject } from '../Utils';

export function selectFields<A extends object | null | undefined>(
  accessor: A,
  fields: '*' | Array<string | number> = '*',
  recursionDepth = 1
): A {
  if (accessor == null) return accessor as A;

  if (Array.isArray(accessor)) {
    return accessor.map((value) =>
      selectFields(value, fields, recursionDepth)
    ) as A;
  }

  if (!isObject(accessor)) return accessor;

  if (fields.length === 0) {
    return {} as A;
  }

  if (typeof fields === 'string') {
    if (recursionDepth > 0) {
      const allAccessorKeys = Object.keys(accessor);
      return allAccessorKeys.reduce((acum, fieldName) => {
        const fieldValue: unknown = lodashGet(accessor, fieldName);

        if (Array.isArray(fieldValue)) {
          lodashSet(
            acum,
            fieldName,
            fieldValue.map((value) => {
              return selectFields(value, '*', recursionDepth - 1);
            })
          );
        } else if (isObject(fieldValue)) {
          lodashSet(
            acum,
            fieldName,
            selectFields(fieldValue, '*', recursionDepth - 1)
          );
        } else {
          lodashSet(acum, fieldName, fieldValue);
        }
        return acum;
      }, {} as NonNullable<A>);
    } else {
      return null as A;
    }
  }

  return fields.reduce((acum, fieldName) => {
    const fieldValue = lodashGet(accessor, fieldName, CacheNotFound);

    if (fieldValue === CacheNotFound) return acum;

    if (Array.isArray(fieldValue)) {
      lodashSet(
        acum,
        fieldName,
        fieldValue.map((value) => {
          return selectFields(value, '*', recursionDepth);
        })
      );
    } else if (isObject(fieldValue)) {
      lodashSet(acum, fieldName, selectFields(fieldValue, '*', recursionDepth));
    } else {
      lodashSet(acum, fieldName, fieldValue);
    }

    return acum;
  }, {} as NonNullable<A>);
}
