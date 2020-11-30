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

  return {
    getAccessor,
    getArrayAccessor,
    isProxy,
    getProxySelection,
  };
}
