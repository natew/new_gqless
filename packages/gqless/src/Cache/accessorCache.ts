import { Selection } from '../Selection';

export interface ProxyAccessor extends Object {
  __proxy?: undefined;
}

export type AccessorCache = ReturnType<typeof createAccessorCache>;

export function createAccessorCache() {
  const proxyMap = new WeakMap<Selection, ProxyAccessor>();
  const arrayProxyMap = new WeakMap<
    Selection,
    WeakMap<unknown[], ProxyAccessor>
  >();
  const proxySet = new WeakSet<ProxyAccessor>();

  const selectionProxyMap = new WeakMap<ProxyAccessor, Selection>();

  const accessorSelectionHistory = new WeakMap<ProxyAccessor, Set<Selection>>();

  const accessorChildRelations = new WeakMap<
    ProxyAccessor,
    Set<ProxyAccessor>
  >();

  function getAccessor(
    selection: Selection,
    proxyFactory: () => ProxyAccessor
  ): ProxyAccessor {
    let proxy = proxyMap.get(selection);

    if (proxy == null) {
      proxy = proxyFactory();
      proxyMap.set(selection, proxy);
      selectionProxyMap.set(proxy, selection);
      proxySet.add(proxy);
    }

    return proxy;
  }

  function getArrayAccessor(
    selection: Selection,
    reference: unknown[],
    proxyFactory: () => ProxyAccessor
  ): ProxyAccessor {
    let proxyMap = arrayProxyMap.get(selection);

    if (proxyMap == null) {
      proxyMap = new WeakMap();
      arrayProxyMap.set(selection, proxyMap);
    }

    let proxy = proxyMap.get(reference);

    if (proxy == null) {
      proxy = proxyFactory();
      proxyMap.set(reference, proxy);
      selectionProxyMap.set(proxy, selection);
      proxySet.add(proxy);
    }

    return proxy;
  }

  function getProxySelection(proxy: ProxyAccessor) {
    return selectionProxyMap.get(proxy);
  }

  function isProxy(obj: any): obj is ProxyAccessor {
    return proxySet.has(obj);
  }

  function addSelectionToAccessorHistory(
    accessor: ProxyAccessor,
    selection: Selection
  ) {
    let selectionSet = accessorSelectionHistory.get(accessor);

    if (selectionSet == null) {
      selectionSet = new Set();
      accessorSelectionHistory.set(accessor, selectionSet);
    }

    selectionSet.add(selection);
  }

  function getSelectionSetHistory(accessor: ProxyAccessor) {
    let selections = accessorSelectionHistory.get(accessor);

    const childs = accessorChildRelations.get(accessor);

    if (childs) {
      const selectionsWithChilds = selections || (selections = new Set());

      childs.forEach((childAccessor) => {
        const childSelections = getSelectionSetHistory(childAccessor);
        if (childSelections) {
          childSelections.forEach((selection) => {
            selectionsWithChilds.add(selection);
          });
        }
      });
    }

    return selections;
  }

  function addAccessorChild(
    parent: ProxyAccessor,
    child: ProxyAccessor | null
  ) {
    if (!child) return;

    let childs = accessorChildRelations.get(parent);

    if (childs == null) {
      childs = new Set();
      accessorChildRelations.set(parent, childs);
    }

    childs.add(child);
  }

  return {
    getAccessor,
    getArrayAccessor,
    isProxy,
    getProxySelection,
    addSelectionToAccessorHistory,
    getSelectionSetHistory,
    addAccessorChild,
  };
}
