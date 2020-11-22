export enum SelectionType {
  Query,
  Mutation,
  Subscription,
}

export type SelectionConstructorArgs = {
  key: string | number;
  prevSelection?: Selection;
  type?: SelectionType;
  alias?: string;
  args?: Record<string, unknown>;
  argTypes?: Record<string, string>;
};

export class Selection {
  key: string | number;

  type: SelectionType;

  args?: Readonly<Record<string, unknown>>;
  argTypes?: Readonly<Record<string, string>>;
  alias?: string;

  cachePath: readonly (string | number)[] = [];
  pathString: string;

  noIndexSelections: readonly Selection[];

  constructor({
    key,
    prevSelection,
    args,
    argTypes,
    type,
    alias,
  }: SelectionConstructorArgs) {
    this.key = key;
    this.args = args;
    this.argTypes = argTypes;
    this.type = type || prevSelection?.type || SelectionType.Query;
    this.alias = alias;

    const pathKey = alias || key;

    this.cachePath = prevSelection ? [...prevSelection.cachePath, pathKey] : [];

    this.pathString = prevSelection
      ? prevSelection.pathString + '.' + pathKey
      : pathKey.toString();

    const prevIndexSelections = prevSelection?.noIndexSelections || [];

    this.noIndexSelections =
      typeof key === 'string'
        ? [...prevIndexSelections, this]
        : prevIndexSelections;
  }
}
