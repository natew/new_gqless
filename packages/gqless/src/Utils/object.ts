export type PlainObject = Record<string | number | symbol, unknown>;

export const isObject = (v: unknown): v is object =>
  v != null && typeof v === 'object';

export const isPlainObject = (v: unknown): v is PlainObject =>
  isObject(v) && !Array.isArray(v);

export const isObjectWithType = <T extends { __typename: string }>(
  v: unknown
): v is T => isPlainObject(v) && typeof v.__typename === 'string';

export function merge<T extends object>(
  target: T,
  sources: (object | undefined | null)[],
  onConflict?: (targetValue: object, sourceValue: object) => object | void
): T {
  for (const source of sources) {
    for (const [sourceKey, sourceValue] of Object.entries(source || {})) {
      if (sourceKey in target) {
        const targetValue: unknown = Reflect.get(target, sourceKey);
        if (sourceValue === targetValue) continue;

        if (isObject(sourceValue) && isObject(targetValue)) {
          const onConflictResult = onConflict?.(targetValue, sourceValue);

          if (onConflictResult === undefined) {
            Reflect.set(
              target,
              sourceKey,
              merge(
                Array.isArray(targetValue) ? [] : {},
                [targetValue, sourceValue],
                onConflict
              )
            );
          } else {
            Reflect.set(target, sourceKey, onConflictResult);
          }
          continue;
        }
      }
      Reflect.set(target, sourceKey, sourceValue);
    }
  }

  return target;
}

type SetGetPath = readonly (string | number)[] | string | number;

function castPath(path: SetGetPath): readonly (string | number)[] {
  return Array.isArray(path) ? path : (path + '').split('.');
}

export function set<T extends object>(
  object: T,
  path: SetGetPath,
  value: unknown
) {
  if (!isObject(object)) return object;

  path = castPath(path);

  const length = path.length;
  const lastIndex = length - 1;

  let index = -1;
  let nested: unknown = object;

  while (nested != null && ++index < length) {
    const key = path[index] + '';
    let newValue = value;

    if (index != lastIndex) {
      const objValue =
        //@ts-expect-error
        nested[key];
      newValue = undefined;
      if (newValue === undefined) {
        newValue = isObject(objValue)
          ? objValue
          : typeof path[index + 1] === 'number'
          ? []
          : {};
      }
    }
    //@ts-expect-error
    nested[key] = newValue;

    //@ts-expect-error
    nested = nested[key];
  }
  return object;
}

export function get<Value = unknown>(
  object: object | null | undefined,
  path: SetGetPath
): Value | undefined;
export function get<Value = unknown, DefaultValue = undefined>(
  object: object | null | undefined,
  path: SetGetPath,
  defaultValue: DefaultValue
): Value | DefaultValue;
export function get<Value = unknown, DefaultValue = undefined>(
  object: object | null | undefined,
  path: SetGetPath,
  defaultValue?: DefaultValue
) {
  path = castPath(path);

  let index = 0;
  const length = path.length;

  while (object != null && index < length) {
    object =
      //@ts-expect-error
      object[path[index++]];
  }
  const value =
    index && index === length
      ? ((object as unknown) as Value)
      : (defaultValue as DefaultValue);
  return value === undefined ? defaultValue : value;
}
