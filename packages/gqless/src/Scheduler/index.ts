import debounce from 'lodash/debounce';

import { InterceptorManager } from '../Interceptor';

export class Scheduler {
  interceptorManager: InterceptorManager;
  fetchSelections: () => void;

  constructor(
    interceptorManager: InterceptorManager,
    resolveAllSelections: () => Promise<void>
  ) {
    this.interceptorManager = interceptorManager;

    this.fetchSelections = debounce(
      () => {
        resolveAllSelections().catch(console.error);
      },
      10,
      {
        maxWait: 1000,
      }
    );

    interceptorManager.globalInterceptor.addSelectionListeners.add(
      (_selection) => {
        this.fetchSelections();
      }
    );
  }
}
