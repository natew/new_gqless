import { Interceptor, createInterceptorManager } from '../src/Interceptor';
import { Selection } from '../src/Selection';

describe('base interceptor', () => {
  test('works', async () => {
    const interceptor = new Interceptor();

    const selectionA = new Selection({
      key: 'a',
    });

    const interceptPromiseA = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        reject,
        500,
        Error("Intercept listener didn't work!")
      );

      interceptor.addSelectionListeners.add((selectionArg) => {
        expect(selectionArg).toBe(selectionA);
        clearTimeout(timeout);
        resolve();
      });
    });

    interceptor.addSelection(selectionA);

    await interceptPromiseA;

    expect(interceptor.selections.has(selectionA)).toBe(true);

    const selectionB = new Selection({
      key: 'b',
    });

    interceptor.listening = false;

    const interceptPromiseB = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(resolve, 500);

      interceptor.addSelectionListeners.add((_selectionArg) => {
        clearTimeout(timeout);
        reject(Error("It shouldn't have received the selection it!"));
      });
    });

    interceptor.addSelection(selectionB);

    await interceptPromiseB;

    expect(interceptor.selections.has(selectionB)).toBe(false);

    interceptor.removeSelections([selectionA]);

    expect(interceptor.selections.has(selectionA)).toBe(false);
  });
});

describe('interceptorManager', () => {
  test('works', () => {
    const manager = createInterceptorManager();

    const tempInterceptor = manager.createInterceptor();

    const selectionA = new Selection({
      key: 'a',
    });

    manager.addSelection(selectionA);

    expect(tempInterceptor.selections.has(selectionA)).toBe(true);
    expect(manager.globalInterceptor.selections.has(selectionA)).toBe(true);

    const selectionB = new Selection({
      key: 'b',
    });

    manager.removeInterceptor(tempInterceptor);
    manager.addSelection(selectionB);

    expect(tempInterceptor.selections.has(selectionB)).toBe(false);
    expect(manager.globalInterceptor.selections.has(selectionB)).toBe(true);

    const selectionC = new Selection({
      key: 'c',
    });

    manager.addSelections([selectionC]);

    expect(manager.globalInterceptor.selections.has(selectionC)).toBe(true);

    manager.removeSelections([selectionA, selectionB, selectionC]);

    expect(manager.globalInterceptor.selections.has(selectionA)).toBe(false);
    expect(manager.globalInterceptor.selections.has(selectionB)).toBe(false);
    expect(manager.globalInterceptor.selections.has(selectionC)).toBe(false);
  });
});
