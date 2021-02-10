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
  union?: string;
};

export class Selection {
  key: string | number;

  type: SelectionType;

  union?: string;

  args?: Readonly<Record<string, unknown>>;
  argTypes?: Readonly<Record<string, string>>;
  alias?: string;

  cachePath: readonly (string | number)[] = [];
  pathString: string;

  noIndexSelections: readonly Selection[];
  selectionsList: readonly Selection[];

  constructor({
    key,
    prevSelection,
    args,
    argTypes,
    type,
    alias,
    union,
  }: SelectionConstructorArgs) {
    this.key = key;
    this.args = args;
    this.argTypes = argTypes;
    this.type = type || prevSelection?.type || SelectionType.Query;
    this.alias = alias;
    this.union = union;

    const pathKey = alias || key;

    this.cachePath = prevSelection
      ? [...prevSelection.cachePath, pathKey]
      : [pathKey];

    this.pathString = prevSelection
      ? prevSelection.pathString + '.' + pathKey
      : pathKey.toString();

    const prevIndexSelections = prevSelection?.noIndexSelections || [];

    this.selectionsList = [...prevIndexSelections, this];

    this.noIndexSelections =
      typeof key === 'string' ? this.selectionsList : prevIndexSelections;
  }
}
