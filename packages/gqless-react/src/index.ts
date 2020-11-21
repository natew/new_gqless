import {
  Dispatch,
  ReactElement,
  useCallback,
  useEffect,
  useReducer,
  useRef,
} from 'react';

import { useUpdate } from './common';

import type { GraphQLError } from 'graphql';
import type {
  createClient,
  GraphQLErrorsContainer,
  ResolveOptions,
} from '@dish/gqless';

function isGraphQLErrorsContainer(err: any): err is GraphQLErrorsContainer {
  return Array.isArray(err.errors);
}

export interface UseTransactionQueryOptions extends ResolveOptions {
  skip?: boolean;
}

export interface UseLazyQueryOptions extends ResolveOptions {}

export interface UseMutationOptions extends ResolveOptions {}

export interface UseTransactionQueryState<A> {
  data: A | undefined;
  errors?: readonly GraphQLError[];
  isLoading: boolean;
}

type UseTransactionQueryReducerAction<A> =
  | { type: 'success'; data: A }
  | { type: 'failure'; errors: readonly GraphQLError[] }
  | { type: 'loading' }
  | {
      type: 'done';
    };

export interface UseLazyQueryState<A> {
  data: A | undefined;
  errors?: readonly GraphQLError[];
  isLoading: boolean;
}

type UseLazyQueryReducerAction<A> =
  | { type: 'success'; data: A }
  | { type: 'failure'; errors: readonly GraphQLError[] }
  | { type: 'loading' };

export interface UseMutationState<A> {
  data: A | undefined;
  errors?: readonly GraphQLError[];
  isLoading: boolean;
}

type UseMutationReducerAction<A> =
  | { type: 'success'; data: A }
  | { type: 'failure'; errors: readonly GraphQLError[] }
  | { type: 'loading' };

export function createReactClient<
  GeneratedSchema extends {
    query: object;
    mutation: object;
    subscription: object;
  } = never
>(
  client: ReturnType<typeof createClient>,
  { defaultSuspense = true }: { defaultSuspense?: boolean } = {}
) {
  const { resolved, scheduler } = client;
  const clientQuery: GeneratedSchema['query'] = client.query;
  const clientMutation: GeneratedSchema['mutation'] = client.mutation;

  function graphql<R extends ReactElement<any, any> | null, P = unknown>(
    component: (props: P) => R,
    { suspense = defaultSuspense }: { suspense?: boolean } = {}
  ) {
    const withGraphQL: {
      (props: P): R;
      displayName: string;
    } = function WithGraphQL(props) {
      let fetchingPromise = useRef<Promise<void>>();
      const forceUpdate = useUpdate();

      const unsubscribe = scheduler.subscribeResolve((promise) => {
        fetchingPromise.current = new Promise<void>((resolve, reject) => {
          promise.then(
            () => {
              fetchingPromise.current = undefined;
              forceUpdate();
              resolve();
            },
            (err) => {
              fetchingPromise.current = undefined;
              reject(err);
            }
          );
        });

        forceUpdate();
      });

      let returnValue: R;

      try {
        returnValue = component(props);
      } finally {
        unsubscribe();
      }

      if (suspense && fetchingPromise.current) {
        throw fetchingPromise.current;
      }
      return returnValue;
    };
    withGraphQL.displayName = `GraphQLComponent(${
      (component as any)?.displayName || (component as any)?.name || 'Anonymous'
    })`;

    return withGraphQL;
  }

  function useQuery({
    suspense = defaultSuspense,
  }: {
    suspense?: boolean;
  } = {}) {
    const fetchingPromise = useRef<Promise<void>>();
    const forceUpdate = useUpdate();

    const unsubscribe = scheduler.subscribeResolve((promise) => {
      fetchingPromise.current = new Promise<void>((resolve, reject) => {
        promise.then(
          () => {
            fetchingPromise.current = undefined;
            forceUpdate();
            resolve();
          },
          (err) => {
            fetchingPromise.current = undefined;
            reject(err);
          }
        );
      });
      forceUpdate();
    });

    useEffect(() => {
      unsubscribe();
    });

    if (suspense && fetchingPromise.current) {
      throw fetchingPromise.current;
    }

    return clientQuery;
  }

  function UseTransactionQueryReducer<A>(
    state: UseTransactionQueryState<A>,
    action: UseTransactionQueryReducerAction<A>
  ): UseTransactionQueryState<A> {
    switch (action.type) {
      case 'loading': {
        return {
          data: state.data,
          isLoading: true,
        };
      }
      case 'success': {
        return {
          data: action.data,
          isLoading: false,
        };
      }
      case 'failure': {
        return {
          data: state.data,
          isLoading: false,
          errors: action.errors,
        };
      }
      case 'done': {
        if (state.isLoading) {
          return {
            data: state.data,
            isLoading: false,
          };
        }
        return state;
      }
    }
  }

  function InitUseTransactionQueryReducer<A>({
    skip,
    refetch,
    noCache,
  }: UseTransactionQueryOptions): UseTransactionQueryState<A> {
    return {
      data: undefined,
      isLoading: skip ? false : refetch || noCache ? true : false,
    };
  }

  function useTransactionQuery<A>(
    fn: (query: typeof clientQuery) => A,
    opts: UseTransactionQueryOptions = {}
  ) {
    const { noCache, refetch, skip } = opts;
    const [state, dispatch] = useReducer(
      UseTransactionQueryReducer,
      opts,
      InitUseTransactionQueryReducer
    ) as [
      UseTransactionQueryState<A>,
      Dispatch<UseTransactionQueryReducerAction<A>>
    ];

    const fnRef = useRef(fn);
    fnRef.current = fn;

    useEffect(() => {
      if (skip) {
        return dispatch({
          type: 'done',
        });
      }

      dispatch({
        type: 'loading',
      });
      resolved<A>(() => fnRef.current(clientQuery), {
        noCache,
        refetch,
      }).then(
        (data) => {
          dispatch({
            type: 'success',
            data,
          });
        },
        (err) => {
          if (err instanceof Error) {
            if (isGraphQLErrorsContainer(err)) {
              dispatch({
                type: 'failure',
                errors: err.errors,
              });
            } else {
              dispatch({
                type: 'failure',
                errors: [err as GraphQLError],
              });
            }
          } else {
            console.error(err);
          }
        }
      );
    }, [skip, noCache, refetch, fnRef, dispatch]);

    return state;
  }

  function UseLazyQueryReducer<A>(
    state: UseLazyQueryState<A>,
    action: UseLazyQueryReducerAction<A>
  ): UseLazyQueryState<A> {
    switch (action.type) {
      case 'loading': {
        return {
          data: state.data,
          isLoading: true,
        };
      }
      case 'success': {
        return {
          data: action.data,
          isLoading: false,
        };
      }
      case 'failure': {
        return {
          data: state.data,
          isLoading: false,
          errors: action.errors,
        };
      }
    }
  }

  function InitUseLazyQueryReducer<A>(): UseLazyQueryState<A> {
    return {
      data: undefined,
      isLoading: false,
    };
  }

  function useLazyQuery<A>(
    fn: (query: typeof clientQuery) => A,
    { noCache, refetch = true }: UseLazyQueryOptions = {}
  ) {
    const [state, dispatch] = useReducer(
      UseLazyQueryReducer,
      undefined,
      InitUseLazyQueryReducer
    ) as [UseLazyQueryState<A>, Dispatch<UseLazyQueryReducerAction<A>>];

    const fnRef = useRef(fn);
    fnRef.current = fn;

    const queryFn = useCallback(() => {
      dispatch({
        type: 'loading',
      });
      return resolved<A>(() => fnRef.current(clientMutation), {
        noCache,
        refetch,
      }).then(
        (data) => {
          dispatch({
            type: 'success',
            data,
          });
          return data;
        },
        (err) => {
          if (err instanceof Error) {
            if (isGraphQLErrorsContainer(err)) {
              dispatch({
                type: 'failure',
                errors: err.errors,
              });
            } else {
              dispatch({
                type: 'failure',
                errors: [err as GraphQLError],
              });
            }
          } else {
            console.error(err);
          }
        }
      );
    }, [refetch, noCache, fnRef, dispatch]);

    return [queryFn, state] as const;
  }

  function UseMutationReducer<A>(
    state: UseMutationState<A>,
    action: UseMutationReducerAction<A>
  ): UseMutationState<A> {
    switch (action.type) {
      case 'loading': {
        return {
          data: state.data,
          isLoading: true,
        };
      }
      case 'success': {
        return {
          data: action.data,
          isLoading: false,
        };
      }
      case 'failure': {
        return {
          data: state.data,
          isLoading: false,
          errors: action.errors,
        };
      }
    }
  }

  function InitUseMutationReducer<A>(): UseMutationState<A> {
    return {
      data: undefined,
      isLoading: false,
    };
  }

  function useMutation<A>(
    fn: (mutation: typeof clientMutation) => A,
    { noCache, refetch = true }: UseMutationOptions = {}
  ) {
    const [state, dispatch] = useReducer(
      UseMutationReducer,
      undefined,
      InitUseMutationReducer
    ) as [UseMutationState<A>, Dispatch<UseMutationReducerAction<A>>];

    const fnRef = useRef(fn);
    fnRef.current = fn;

    const mutate = useCallback(() => {
      dispatch({ type: 'loading' });
      return resolved<A>(() => fnRef.current(clientMutation), {
        noCache,
        refetch,
      }).then(
        (data) => {
          dispatch({
            type: 'success',
            data,
          });

          return data;
        },
        (err) => {
          if (err instanceof Error) {
            if (isGraphQLErrorsContainer(err)) {
              dispatch({
                type: 'failure',
                errors: err.errors,
              });
            } else {
              dispatch({
                type: 'failure',
                errors: [err as GraphQLError],
              });
            }
          } else {
            console.error(err);
          }
        }
      );
    }, [refetch, noCache, fnRef, dispatch]);

    return [mutate, state] as const;
  }

  const state = new Proxy(
    {
      isLoading: false,
    },
    {
      get(target, key, receiver) {
        if (key === 'isLoading') {
          return Boolean(scheduler.resolving);
        }
        return Reflect.get(target, key, receiver);
      },
    }
  );

  return {
    useQuery,
    useLazyQuery,
    useTransactionQuery,
    useMutation,
    graphql,
    state,
  };
}
