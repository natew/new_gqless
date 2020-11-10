import { Selection } from '../Selection';

export class AccessorCache {
  proxyMap = new WeakMap<Selection, object>();

  getAccessor(selection: Selection, proxyFactory: () => object): object {
    let proxy = this.proxyMap.get(selection);

    if (proxy == null) {
      proxy = proxyFactory();
      this.proxyMap.set(selection, proxy);
    }

    return proxy;
  }
}
