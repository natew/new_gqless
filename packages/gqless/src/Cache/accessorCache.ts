import { Selection } from '../Selection';

export function createAccessorCache() {
  const proxyMap = new WeakMap<Selection, object>();
  const proxySet = new WeakSet<object>();

  const selectionProxyMap = new WeakMap<object, Selection>();

  function getAccessor(
    selection: Selection,
    proxyFactory: () => object
  ): object {
    let proxy = proxyMap.get(selection);

    if (proxy == null) {
      proxy = proxyFactory();
      proxyMap.set(selection, proxy);
      selectionProxyMap.set(proxy, selection);
    }

    return proxy;
  }

  function getProxySelection(proxy: object) {
    return selectionProxyMap.get(proxy);
  }

  function isProxy(obj: any): obj is object {
    return proxySet.has(obj);
  }

  return {
    getAccessor,
    isProxy,
    getProxySelection,
  };
}
