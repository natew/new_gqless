import {
  AccessorCreators,
  createSchemaUnions,
  SchemaUnions,
} from '../Accessor';
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
import {
  createNormalizationHandler,
  NormalizationHandler,
  NormalizationOptions,
} from '../Normalization';
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
  readonly schemaUnions: SchemaUnions;
  readonly normalizationHandler: NormalizationHandler;
}

export interface ClientOptions<
  ObjectTypesNames extends string = never,
  SchemaObjectTypes extends {
    [P in ObjectTypesNames]: {
      __typename: P | null;
    };
  } = never
> {
  schema: Readonly<Schema>;
  scalarsEnumsHash: ScalarsEnumsHash;
  queryFetcher: QueryFetcher;
  catchSelectionsTimeMS?: number;
  retry?: RetryOptions;
  normalization?:
    | NormalizationOptions<ObjectTypesNames, SchemaObjectTypes>
    | boolean;
}

export function createClient<
  GeneratedSchema extends {
    query: {};
    mutation: {};
    subscription: {};
  } = never,
  ObjectTypesNames extends string = never,
  ObjectTypes extends {
    [P in ObjectTypesNames]: {
      __typename: P | null;
    };
  } = never
>({
  schema,
  scalarsEnumsHash,
  queryFetcher,
  catchSelectionsTimeMS = 10,
  retry,
  normalization = true,
}: ClientOptions<ObjectTypesNames, ObjectTypes>) {
  const interceptorManager = createInterceptorManager();

  const { globalInterceptor } = interceptorManager;

  const accessorCache = createAccessorCache();

  const eventHandler = new EventHandler();

  const normalizationHandler = createNormalizationHandler(
    normalization,
    eventHandler,
    schema,
    scalarsEnumsHash
  );

  const clientCache = createCache(normalizationHandler);

  const selectionManager = createSelectionManager();

  const scheduler = createScheduler(
    interceptorManager,
    resolveSchedulerSelections,
    catchSelectionsTimeMS
  );

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
    normalizationHandler,
  };

  const {
    resolved,
    buildAndFetchSelections,
    resolveSelections,
  } = createResolvers(innerState, catchSelectionsTimeMS);

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

  const {
    query,
    mutation,
    subscription,
    setCache,
    assignSelections,
  } = AccessorCreators<GeneratedSchema>(innerState);

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
