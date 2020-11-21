import { Selection } from '../Selection';

export class Interceptor {
  selections = new Set<Selection>();
  listening = true;
  selectionAddListeners = new Set<(selection: Selection) => void>();

  addSelection(selection: Selection) {
    if (this.listening) {
      this.selections.add(selection);

      for (const listener of this.selectionAddListeners) {
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

export type InterceptorManager = ReturnType<typeof createInterceptorManager>;

export function createInterceptorManager() {
  const interceptors = new Set<Interceptor>();

  const globalInterceptor = new Interceptor();
  interceptors.add(globalInterceptor);

  function createInterceptor() {
    const interceptor = new Interceptor();
    interceptors.add(interceptor);
    return interceptor;
  }

  function removeInterceptor(interceptor: Interceptor) {
    interceptors.delete(interceptor);
  }

  function addSelection(selection: Selection) {
    for (const interceptor of interceptors) {
      interceptor.addSelection(selection);
    }
  }

  function addSelections(selection: Selection[] | Set<Selection>) {
    selection.forEach(addSelection);
  }

  function removeSelections(selections: Selection[] | Set<Selection>) {
    for (const interceptor of interceptors) {
      interceptor.removeSelections(selections);
    }
  }

  return {
    interceptors,
    globalInterceptor,
    createInterceptor,
    removeInterceptor,
    addSelection,
    addSelections,
    removeSelections,
  };
}
