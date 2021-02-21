import lodashGet from 'lodash/get';
import lodashSet from 'lodash/set';
// import lodashMerge from 'lodash/mergeWith';

import { Selection } from '../Selection';
import { isObject } from '../Utils';
import { EventHandler } from '../Events';

export const CacheNotFound = Symbol('Not Found');

export type CacheType = Record<string, unknown>;

// function mergeCustomizer(
//   currentValue: unknown,
//   incomingValue: unknown
// ): unknown[] | void {
//   if (
//     Array.isArray(currentValue) &&
//     Array.isArray(incomingValue) &&
//     currentValue.length !== incomingValue.length
//   ) {
//     return incomingValue;
//   }
// }

export function getId(obj: any): string | void {
  if (typeof obj === 'object' && obj != null) {
    const __typename: unknown = obj.__typename;
    const id: unknown = obj.id || obj._id;

    if (
      (typeof id === 'string' || typeof id === 'number') &&
      typeof __typename === 'string'
    ) {
      return __typename + id;
    }
  }
}

export function createCache(eventHandler?: EventHandler) {
  const cache: CacheType = {};

  const normalizedCache: Record<string, object | undefined> = {};

  function getCacheFromSelection(
    selection: Selection,
    notFoundValue: unknown = CacheNotFound
  ) {
    return lodashGet(cache, selection.cachePath, notFoundValue);
  }

  function setCacheFromSelection(selection: Selection, value: unknown) {
    const prevSelection = selection.selectionsList[
      selection.selectionsList.length - 2
    ] as Selection | undefined;

    if (prevSelection) {
      console.log(5858, prevSelection.pathString);
      switch (prevSelection.pathString) {
        // case 'query':
        // case 'mutation':
        // case 'subscription':
        //   break;
        default: {
          const dataPrevSelection = lodashGet(cache, prevSelection.cachePath);

          if (isObject(dataPrevSelection)) {
            const id =
              getId(dataPrevSelection) || `[${prevSelection.pathString}]`;

            // console.log(
            //   'set prev data before',
            //   JSON.stringify(dataPrevSelection)
            // );
            const newData = Object.assign(
              Array.isArray(dataPrevSelection) ? [] : {},
              dataPrevSelection,
              { [selection.key]: value }
            );
            normalizedCache[id] = newData;

            setCacheFromSelection(prevSelection, newData);
            eventHandler?.sendCacheChange({
              data: newData,
              selection: prevSelection,
            });

            // console.log(
            //   'set prev data after',
            //   JSON.stringify(dataPrevSelection)
            // );
          } else {
            // console.log('no prev data', {
            //   prevSelection: prevSelection.cachePath,
            //   selection: selection.cachePath,
            //   value,
            // });
            // const newData = { [selection.key]: value };
            // setCacheFromSelection(prevSelection, newData);
            // eventHandler?.sendCacheChange({
            //   data: newData,
            //   selection: prevSelection,
            // });
          }

          break;
        }
      }
    }

    lodashSet(cache, selection.cachePath, value);
  }

  function mergeCache(
    data: unknown,
    _prefix: 'query' | 'mutation' | 'subscription',
    scalarSelections: Selection[]
  ) {
    const normalizableSelections = new Set<Selection>();

    for (const selection of scalarSelections) {
      for (const intermediateSelection of selection.selectionsList.slice(
        0,
        -1
      )) {
        normalizableSelections.add(intermediateSelection);
      }
    }

    const sortedNormalizableSelection = Array.from(normalizableSelections);

    sortedNormalizableSelection.sort(
      (a, b) => b.selectionsList.length - a.selectionsList.length
    );

    for (const selection of sortedNormalizableSelection) {
      const dataPath = selection.cachePath.slice(1);
      const newData =
        dataPath.length === 0
          ? data
          : lodashGet(data, selection.cachePath.slice(1));

      let result: object;
      if (isObject(newData)) {
        const id = getId(newData) || `[${selection.pathString}]`;

        const existingData = normalizedCache[id];

        if (existingData) {
          console.log(116, {
            newData,
            existingData,
          });
          if (Array.isArray(newData) && Array.isArray(existingData)) {
            console.log(117, {
              newData,
              existingData,
            });
            if (newData.length !== existingData.length) {
              result = normalizedCache[id] = newData;
              console.log(119, result);
            } else {
              result = newData.map((newValue, index) => {
                const existingValue = existingData[index];
                if (isObject(newValue) && isObject(existingValue)) {
                  const newValueCopy = { ...newValue };
                  return Object.assign(newValue, existingValue, newValueCopy);
                }
                return newValue;
              });
            }
          } else {
            result = Object.assign({}, existingData, newData);
          }

          switch (selection.pathString) {
            case 'query':
            case 'mutation':
            case 'subscription':
              continue;
            default:
              eventHandler?.sendCacheChange({
                data: result,
                selection,
              });
              break;
          }
        } else {
          result = normalizedCache[id] = newData;
        }
      } else {
        result = newData;
      }

      console.log(141, {
        cachePath: selection.cachePath,
        result,
      });

      lodashSet(cache, selection.cachePath, result);

      // for (const selection of scalarSelections) {
      //   setCacheFromSelection(
      //     selection,
      //     lodashGet(data, selection.cachePath.slice(1))
      //   );
      // }

      // setCacheFromSelection(selection, newData);
    }

    // for (const selection of scalarSelections) {
    //   lodashSet(cache, selection.cachePath, lodashGet(data, selection.cachePath))
    // }

    // lodashMerge(cache, { [prefix]: data }, mergeCustomizer);

    // Object.keys(normalizedCache).length &&
    //   console.log('normalizedCache', JSON.stringify(normalizedCache, null, 2));
  }

  return { cache, getCacheFromSelection, setCacheFromSelection, mergeCache };
}

export type CacheInstance = ReturnType<typeof createCache>;
