import { GraphQLResolveInfo } from 'graphql';
export type Maybe<T> = T | null;
export type Exact<T extends { [key: string]: unknown }> = {
  [K in keyof T]: T[K];
};
export type MakeOptional<T, K extends keyof T> = Omit<T, K> &
  { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> &
  { [SubKey in K]: Maybe<T[SubKey]> };
export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<DeepPartial<TResult>> | DeepPartial<TResult>;
export type RequireFields<T, K extends keyof T> = {
  [X in Exclude<keyof T, K>]?: T[X];
} &
  { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
  _FieldSet: any;
};

export type Dog = {
  __typename?: 'Dog';
  id: Scalars['ID'];
  name: Scalars['String'];
  owner?: Maybe<Human>;
};

export type Human = {
  __typename?: 'Human';
  id: Scalars['ID'];
  name: Scalars['String'];
  dogs?: Maybe<Array<Dog>>;
};

export type Query = {
  __typename?: 'Query';
  expectedError: Scalars['Boolean'];
  expectedNullableError?: Maybe<Scalars['Boolean']>;
  thirdTry: Scalars['Boolean'];
  dogs: Array<Dog>;
  time: Scalars['String'];
  stringList: Array<Scalars['String']>;
  humans: Array<Human>;
};

export type Mutation = {
  __typename?: 'Mutation';
  renameDog?: Maybe<Dog>;
  renameHuman?: Maybe<Human>;
};

export type MutationrenameDogArgs = {
  id: Scalars['ID'];
  name: Scalars['String'];
};

export type MutationrenameHumanArgs = {
  id: Scalars['ID'];
  name: Scalars['String'];
};

export type ResolverTypeWrapper<T> = Promise<T> | T;

export type LegacyStitchingResolver<TResult, TParent, TContext, TArgs> = {
  fragment: string;
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};

export type NewStitchingResolver<TResult, TParent, TContext, TArgs> = {
  selectionSet: string;
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type StitchingResolver<TResult, TParent, TContext, TArgs> =
  | LegacyStitchingResolver<TResult, TParent, TContext, TArgs>
  | NewStitchingResolver<TResult, TParent, TContext, TArgs>;
export type Resolver<TResult, TParent = {}, TContext = {}, TArgs = {}> =
  | ResolverFn<TResult, TParent, TContext, TArgs>
  | StitchingResolver<TResult, TParent, TContext, TArgs>;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterator<TResult> | Promise<AsyncIterator<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<
  TResult,
  TKey extends string,
  TParent,
  TContext,
  TArgs
> {
  subscribe: SubscriptionSubscribeFn<
    { [key in TKey]: TResult },
    TParent,
    TContext,
    TArgs
  >;
  resolve?: SubscriptionResolveFn<
    TResult,
    { [key in TKey]: TResult },
    TContext,
    TArgs
  >;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<
  TResult,
  TKey extends string,
  TParent,
  TContext,
  TArgs
> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<
  TResult,
  TKey extends string,
  TParent = {},
  TContext = {},
  TArgs = {}
> =
  | ((
      ...args: any[]
    ) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = {}, TContext = {}> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = {}, TContext = {}> = (
  obj: T,
  context: TContext,
  info: GraphQLResolveInfo
) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<
  TResult = {},
  TParent = {},
  TContext = {},
  TArgs = {}
> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = {
  Dog: ResolverTypeWrapper<Dog>;
  ID: ResolverTypeWrapper<Scalars['ID']>;
  String: ResolverTypeWrapper<Scalars['String']>;
  Human: ResolverTypeWrapper<Human>;
  Query: ResolverTypeWrapper<{}>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']>;
  Mutation: ResolverTypeWrapper<{}>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  Dog: Dog;
  ID: Scalars['ID'];
  String: Scalars['String'];
  Human: Human;
  Query: {};
  Boolean: Scalars['Boolean'];
  Mutation: {};
};

export type DogResolvers<
  ContextType = any,
  ParentType extends ResolversParentTypes['Dog'] = ResolversParentTypes['Dog']
> = {
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  owner?: Resolver<Maybe<ResolversTypes['Human']>, ParentType, ContextType>;
  isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type HumanResolvers<
  ContextType = any,
  ParentType extends ResolversParentTypes['Human'] = ResolversParentTypes['Human']
> = {
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  dogs?: Resolver<Maybe<Array<ResolversTypes['Dog']>>, ParentType, ContextType>;
  isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type QueryResolvers<
  ContextType = any,
  ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']
> = {
  expectedError?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  expectedNullableError?: Resolver<
    Maybe<ResolversTypes['Boolean']>,
    ParentType,
    ContextType
  >;
  thirdTry?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  dogs?: Resolver<Array<ResolversTypes['Dog']>, ParentType, ContextType>;
  time?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  stringList?: Resolver<
    Array<ResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  humans?: Resolver<Array<ResolversTypes['Human']>, ParentType, ContextType>;
};

export type MutationResolvers<
  ContextType = any,
  ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']
> = {
  renameDog?: Resolver<
    Maybe<ResolversTypes['Dog']>,
    ParentType,
    ContextType,
    RequireFields<MutationrenameDogArgs, 'id' | 'name'>
  >;
  renameHuman?: Resolver<
    Maybe<ResolversTypes['Human']>,
    ParentType,
    ContextType,
    RequireFields<MutationrenameHumanArgs, 'id' | 'name'>
  >;
};

export type Resolvers<ContextType = any> = {
  Dog?: DogResolvers<ContextType>;
  Human?: HumanResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
};

/**
 * @deprecated
 * Use "Resolvers" root object instead. If you wish to get "IResolvers", add "typesPrefix: I" to your config.
 */
export type IResolvers<ContextType = any> = Resolvers<ContextType>;

type Loader<TReturn, TObj, TParams, TContext> = (
  queries: Array<{
    obj: TObj;
    params: TParams;
  }>,
  context: TContext & {
    reply: import('fastify').FastifyReply;
  }
) => Promise<Array<DeepPartial<TReturn>>>;
type LoaderResolver<TReturn, TObj, TParams, TContext> =
  | Loader<TReturn, TObj, TParams, TContext>
  | {
      loader: Loader<TReturn, TObj, TParams, TContext>;
      opts?: {
        cache?: boolean;
      };
    };
export interface Loaders<
  TContext = import('mercurius').MercuriusContext & {
    reply: import('fastify').FastifyReply;
  }
> {
  Dog?: {
    id?: LoaderResolver<Scalars['ID'], Dog, {}, TContext>;
    name?: LoaderResolver<Scalars['String'], Dog, {}, TContext>;
    owner?: LoaderResolver<Maybe<Human>, Dog, {}, TContext>;
  };

  Human?: {
    id?: LoaderResolver<Scalars['ID'], Human, {}, TContext>;
    name?: LoaderResolver<Scalars['String'], Human, {}, TContext>;
    dogs?: LoaderResolver<Maybe<Array<Dog>>, Human, {}, TContext>;
  };
}
export type DeepPartial<T> = T extends Function
  ? T
  : T extends Array<infer U>
  ? _DeepPartialArray<U>
  : T extends object
  ? _DeepPartialObject<T>
  : T | undefined;

interface _DeepPartialArray<T> extends Array<DeepPartial<T>> {}
type _DeepPartialObject<T> = { [P in keyof T]?: DeepPartial<T[P]> };

declare module 'mercurius' {
  interface IResolvers
    extends Resolvers<import('mercurius').MercuriusContext> {}
  interface MercuriusLoaders extends Loaders {}
}
