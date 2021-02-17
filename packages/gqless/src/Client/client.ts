import { AccessorCreators, createSchemaUnions } from '../Accessor';
import {
  AccessorCache,
  CacheInstance,
  createAccessorCache,
  createCache,
} from '../Cache';
import { EventHandler } from '../Events';
import { createRefetch } from '../Helpers/refetch';
import { createSSRHelpers } from '../Helpers/ssr';
import { createInterceptorManager, InterceptorManager } from '../Interceptor';
import { createScheduler, Scheduler } from '../Scheduler';
import { QueryFetcher, ScalarsEnumsHash, Schema } from '../Schema/types';
import { Selection } from '../Selection/selection';
import { createSelectionBuilder } from '../Selection/SelectionBuilder';
import {
  createSelectionManager,
  SelectionManager,
} from '../Selection/SelectionManager';
import { createResolvers, RetryOptions } from './resolvers';

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
  readonly schemaUnions: ReturnType<typeof createSchemaUnions>;
}

export interface ClientOptions {
  schema: Readonly<Schema>;
  scalarsEnumsHash: ScalarsEnumsHash;
  queryFetcher: QueryFetcher;
  catchSelectionsTimeMS?: number;
  retry?: RetryOptions;
}

export function createClient<
  GeneratedSchema extends {
    query: {};
    mutation: {};
    subscription: {};
  } = never
>({
  schema,
  scalarsEnumsHash,
  queryFetcher,
  catchSelectionsTimeMS = 10,
  retry,
}: ClientOptions) {
  const interceptorManager = createInterceptorManager();

  const { globalInterceptor } = interceptorManager;

  const accessorCache = createAccessorCache();

  const clientCache = createCache();

  const selectionManager = createSelectionManager();

  const scheduler = createScheduler(
    interceptorManager,
    resolveSchedulerSelections,
    catchSelectionsTimeMS
  );

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
    schemaUnions: createSchemaUnions(schema),
  };

  const {
    resolved,
    buildAndFetchSelections,
    resolveSelections,
  } = createResolvers(innerState);

  async function resolveSchedulerSelections(selections: Set<Selection>) {
    const resolvingPromise = scheduler.resolving;

    const resolvePromise = resolveSelections(selections, undefined, {
      retry: retry === undefined ? true : retry,
      scheduler: true,
    });

    globalInterceptor.removeSelections(selections);
    try {
      await resolvePromise;
    } catch (error) {
      /* istanbul ignore else */
      if (resolvingPromise) {
        resolvingPromise.resolve({
          error,
          selections,
        });
      }
    }
  }

  const refetch = createRefetch(innerState, resolveSelections);

  const { createSchemaAccesor, setCache, assignSelections } = AccessorCreators(
    innerState
  );

  const client: GeneratedSchema = createSchemaAccesor();

  const query: GeneratedSchema['query'] = client.query;
  const mutation: GeneratedSchema['mutation'] = client.mutation;
  const subscription: GeneratedSchema['subscription'] = client.subscription;

  const { hydrateCache, prepareRender } = createSSRHelpers({
    innerState,
    query,
    refetch,
  });

  const mutate = <T>(
    fn: (
      mutation: GeneratedSchema['mutation'],
      helpers: {
        query: GeneratedSchema['query'];
        setCache: typeof setCache;
        assignSelections: typeof assignSelections;
      }
    ) => T
  ): Promise<T> => {
    return resolved(() => fn(mutation, { setCache, assignSelections, query }), {
      refetch: true,
    });
  };

  const { buildSelection } = createSelectionBuilder(innerState);

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
    setCache,
    hydrateCache,
    prepareRender,
    assignSelections,
    mutate,
    buildSelection,
  };
}
