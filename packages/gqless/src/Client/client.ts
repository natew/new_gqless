import { AccessorCreators } from '../Accessor';
import {
  AccessorCache,
  CacheInstance,
  createAccessorCache,
  createCache,
} from '../Cache';
import { EventHandler } from '../Events';
import { createRefetch } from '../Helpers/refetch';
import { createInterceptorManager, InterceptorManager } from '../Interceptor';
import { createScheduler, Scheduler } from '../Scheduler';
import { QueryFetcher, ScalarsEnumsHash, Schema } from '../Schema/types';
import { createSelectionManager, SelectionManager } from '../Selection';
import { createResolvers } from './resolvers';

export interface InnerClientState {
  allowCache: boolean;
  foundValidCache: boolean;
  clientCache: CacheInstance;
  readonly accessorCache: AccessorCache;
  readonly selectionManager: SelectionManager;
  readonly interceptorManager: InterceptorManager;
  readonly scheduler: Scheduler;
  readonly eventHandler: EventHandler;
  readonly schema: Readonly<Schema>;
  readonly scalarsEnumsHash: Readonly<ScalarsEnumsHash>;
  readonly queryFetcher: QueryFetcher;
}

export function createClient<
  GeneratedSchema extends {
    query: {};
    mutation: {};
    subscription: {};
  } = never
>(
  schema: Readonly<Schema>,
  scalarsEnumsHash: ScalarsEnumsHash,
  queryFetcher: QueryFetcher
) {
  const interceptorManager = createInterceptorManager();

  const { globalInterceptor } = interceptorManager;

  const accessorCache = createAccessorCache();

  const clientCache = createCache();

  const selectionManager = createSelectionManager();

  const scheduler = createScheduler(interceptorManager, resolveAllSelections);

  const eventHandler = new EventHandler();

  const innerState: InnerClientState = {
    allowCache: true,
    foundValidCache: true,
    clientCache,
    accessorCache,
    selectionManager,
    interceptorManager,
    schema,
    scalarsEnumsHash,
    scheduler,
    eventHandler,
    queryFetcher,
  };

  const {
    resolved,
    buildAndFetchSelections,
    resolveSelections,
  } = createResolvers(innerState);

  async function resolveAllSelections() {
    const resolvingPromise = scheduler.resolving!;

    try {
      await resolveSelections(globalInterceptor.selections);
    } catch (err) {
      resolvingPromise.promise.catch(console.error);
      resolvingPromise.reject(err);
    }
  }

  const refetch = createRefetch(innerState, resolveSelections);

  const { createSchemaAccesor } = AccessorCreators(innerState);

  const client: GeneratedSchema = createSchemaAccesor();

  const query: GeneratedSchema['query'] = client.query;
  const mutation: GeneratedSchema['mutation'] = client.mutation;
  const subscription: GeneratedSchema['subscription'] = client.subscription;

  return {
    query,
    mutation,
    subscription,
    resolved,
    cache: innerState.clientCache.cache,
    interceptorManager,
    scheduler,
    refetch,
    accessorCache,
    buildAndFetchSelections,
    eventHandler,
  };
}
