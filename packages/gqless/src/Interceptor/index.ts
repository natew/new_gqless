import { Selection } from '../Selection';

export class Interceptor {
  selections = new Set<Selection>();
  listening = true;
  addSelectionListeners = new Set<(selection: Selection) => void>();

  addSelection(selection: Selection) {
    if (this.listening) {
      this.selections.add(selection);

      for (const listener of this.addSelectionListeners) {
        listener(selection);
      }
    }
  }

  removeSelections(selections: Set<Selection> | Selection[]) {
    for (const selection of selections) {
      this.selections.delete(selection);
    }
  }
}

export class InterceptorManager {
  interceptors = new Set<Interceptor>();
  globalInterceptor: Interceptor;

  constructor() {
    this.globalInterceptor = new Interceptor();
    this.interceptors.add(this.globalInterceptor);
  }

  createInterceptor() {
    const interceptor = new Interceptor();
    this.interceptors.add(interceptor);
    return interceptor;
  }

  removeInterceptor(interceptor: Interceptor) {
    this.interceptors.delete(interceptor);
  }

  addSelection(selection: Selection) {
    for (const interceptor of this.interceptors) {
      interceptor.addSelection(selection);
    }
  }

  addSelections(selection: Selection[] | Set<Selection>) {
    selection.forEach(this.addSelection);
  }

  removeSelections(selections: Selection[] | Set<Selection>) {
    for (const interceptor of this.interceptors) {
      interceptor.removeSelections(selections);
    }
  }
}
