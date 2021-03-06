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
import { gqlessError } from '../Error';
import { EventHandler } from '../Events';
import { createPrefetch } from '../Helpers/prefetch';
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

export interface SubscribeEvents {
  onData: (data: Record<string, unknown>) => void;
  onError: (payload: {
    error: gqlessError;
    data: Record<string, unknown> | null;
  }) => void;
  onStart?: () => void;
  onComplete?: () => void;
}

export interface SubscriptionsClient {
  subscribe(opts: {
    query: string;
    variables: Record<string, unknown> | undefined;
    selections: Selection[];
    events:
      | ((ctx: { selections: Selection[] }) => SubscribeEvents)
      | SubscribeEvents;
    cacheKey?: string;
  }): Promise<{
    unsubscribe: () => Promise<void>;
  }>;
  unsubscribe(selections: Selection[] | Set<Selection>): Promise<void>;
  close(): Promise<void>;
  setConnectionParams(
    connectionParams:
      | (() => Record<string, unknown> | Promise<Record<string, unknown>>)
      | Record<string, unknown>,
    restartClient?: boolean
  ): void;
}

export interface ClientOptions<
  ObjectTypesNames extends string = never,
  SchemaObjectTypes extends {
    [P in ObjectTypesNames]: {
      __typename: P | undefined;
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
  subscriptionsClient?: SubscriptionsClient;
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
      __typename: P | undefined;
    };
  } = never
>({
  schema,
  scalarsEnumsHash,
  queryFetcher,
  catchSelectionsTimeMS = 10,
  retry,
  normalization = true,
  subscriptionsClient,
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
  } = createResolvers(innerState, catchSelectionsTimeMS, subscriptionsClient);

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

  async function mutate<T = any>(
    fn: (mutation: GeneratedSchema['mutation']) => T,
    opts: {
      onComplete?: (
        data: T,
        helpers: {
          query: GeneratedSchema['query'];
          setCache: typeof setCache;
          assignSelections: typeof assignSelections;
        }
      ) => void;
      onError?: (
        error: gqlessError,
        helpers: {
          query: GeneratedSchema['query'];
          setCache: typeof setCache;
          assignSelections: typeof assignSelections;
        }
      ) => void;
    } = {}
  ): Promise<T> {
    try {
      const data = await resolved<T>(() => fn(mutation), {
        refetch: true,
      });
      opts.onComplete?.(data, {
        query,
        setCache,
        assignSelections,
      });
      return data;
    } catch (err) {
      const error = gqlessError.create(err, mutate);

      opts.onError?.(error, {
        query,
        setCache,
        assignSelections,
      });

      throw error;
    }
  }

  const { buildSelection } = createSelectionBuilder(innerState);

  const prefetch = createPrefetch<GeneratedSchema>(query, innerState);

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
    subscriptionsClient,
    prefetch,
  };
}
