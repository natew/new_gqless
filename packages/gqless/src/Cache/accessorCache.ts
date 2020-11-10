import { Selection } from '../Selection';

export function createAccessorCache() {
  const proxyMap = new WeakMap<Selection, object>();

  function getAccessor(
    selection: Selection,
    proxyFactory: () => object
  ): object {
    let proxy = proxyMap.get(selection);

    if (proxy == null) {
      proxy = proxyFactory();
      proxyMap.set(selection, proxy);
    }

    return proxy;
  }

  return {
    getAccessor,
  };
}
