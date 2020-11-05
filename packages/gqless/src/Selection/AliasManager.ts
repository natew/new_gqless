export class AliasManager {
  incId = 0;
  aliasMap = new Map<string, string>();

  getVariableAlias(
    variables: Record<string, unknown>,
    variableTypes: Record<string, string>
  ) {
    const key = `${JSON.stringify(variables)}-${JSON.stringify(variableTypes)}`;
    let alias = this.aliasMap.get(key);

    if (!alias) {
      alias = `gqlessAlias_${this.incId++}`;
      this.aliasMap.set(key, alias);
    }

    return alias;
  }
}
