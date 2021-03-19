import { InnerClientState } from '../Client/client';
import { SchedulerPromiseValue } from '../Scheduler';

export function createPrefetch<
  GeneratedSchema extends {
    query: object;
  }
>(query: GeneratedSchema['query'], { scheduler }: InnerClientState) {
  return function prefetch<TData>(
    fn: (query: GeneratedSchema['query']) => TData
  ):
    | (Promise<TData> & {
        schedulerPromise: Promise<SchedulerPromiseValue>;
      })
    | TData {
    const existingData = fn(query);

    if (scheduler.resolving) {
      return Object.assign(
        scheduler.resolving.promise.then(() => prefetch(fn)),
        {
          schedulerPromise: scheduler.resolving.promise,
        }
      );
    }
    return existingData;
  };
}
