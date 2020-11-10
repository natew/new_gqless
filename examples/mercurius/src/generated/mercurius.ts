import {
  GraphQLResolveInfo,
  GraphQLScalarType,
  GraphQLScalarTypeConfig,
} from 'graphql';
export type Maybe<T> = T | null;
export type Exact<T extends { [key: string]: unknown }> = {
  [K in keyof T]: T[K];
};
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
  ExampleScalar: any;
};

export enum GreetingsEnum {
  Hello = 'Hello',
  Hi = 'Hi',
  Hey = 'Hey',
}

export type GreetingsInput = {
  language: Scalars['String'];
  value?: Maybe<Scalars['String']>;
  scal?: Maybe<Scalars['ExampleScalar']>;
};

export type Query = {
  __typename?: 'Query';
  simpleString: Scalars['String'];
  stringWithArgs: Scalars['String'];
  stringNullableWithArgs?: Maybe<Scalars['String']>;
  stringNullableWithArgsArray?: Maybe<Scalars['String']>;
  object?: Maybe<Human>;
  objectArray?: Maybe<Array<Maybe<Human>>>;
  objectWithArgs: Human;
  arrayString: Array<Scalars['String']>;
  arrayObjectArgs: Array<Human>;
  greetings: GreetingsEnum;
  giveGreetingsInput: Scalars['String'];
  number: Scalars['Int'];
};

export type QueryStringWithArgsArgs = {
  hello: Scalars['String'];
};

export type QueryStringNullableWithArgsArgs = {
  hello: Scalars['String'];
  helloTwo?: Maybe<Scalars['String']>;
};

export type QueryStringNullableWithArgsArrayArgs = {
  hello: Array<Maybe<Scalars['String']>>;
};

export type QueryObjectWithArgsArgs = {
  who: Scalars['String'];
};

export type QueryArrayObjectArgsArgs = {
  limit: Scalars['Int'];
};

export type QueryGiveGreetingsInputArgs = {
  input: GreetingsInput;
};

export type Mutation = {
  __typename?: 'Mutation';
  increment: Scalars['Int'];
};

export type MutationIncrementArgs = {
  n: Scalars['Int'];
};

export type Human = {
  __typename?: 'Human';
  name: Scalars['String'];
  father: Human;
  fieldWithArgs: Scalars['Int'];
  sons?: Maybe<Array<Human>>;
};

export type HumanFieldWithArgsArgs = {
  id: Scalars['Int'];
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

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

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
  ExampleScalar: ResolverTypeWrapper<DeepPartial<Scalars['ExampleScalar']>>;
  GreetingsEnum: ResolverTypeWrapper<DeepPartial<GreetingsEnum>>;
  GreetingsInput: ResolverTypeWrapper<DeepPartial<GreetingsInput>>;
  String: ResolverTypeWrapper<DeepPartial<Scalars['String']>>;
  Query: ResolverTypeWrapper<{}>;
  Int: ResolverTypeWrapper<DeepPartial<Scalars['Int']>>;
  Mutation: ResolverTypeWrapper<{}>;
  Human: ResolverTypeWrapper<DeepPartial<Human>>;
  Boolean: ResolverTypeWrapper<DeepPartial<Scalars['Boolean']>>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  ExampleScalar: DeepPartial<Scalars['ExampleScalar']>;
  GreetingsInput: DeepPartial<GreetingsInput>;
  String: DeepPartial<Scalars['String']>;
  Query: {};
  Int: DeepPartial<Scalars['Int']>;
  Mutation: {};
  Human: DeepPartial<Human>;
  Boolean: DeepPartial<Scalars['Boolean']>;
};

export interface ExampleScalarScalarConfig
  extends GraphQLScalarTypeConfig<ResolversTypes['ExampleScalar'], any> {
  name: 'ExampleScalar';
}

export type QueryResolvers<
  ContextType = any,
  ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']
> = {
  simpleString?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  stringWithArgs?: Resolver<
    ResolversTypes['String'],
    ParentType,
    ContextType,
    RequireFields<QueryStringWithArgsArgs, 'hello'>
  >;
  stringNullableWithArgs?: Resolver<
    Maybe<ResolversTypes['String']>,
    ParentType,
    ContextType,
    RequireFields<QueryStringNullableWithArgsArgs, 'hello'>
  >;
  stringNullableWithArgsArray?: Resolver<
    Maybe<ResolversTypes['String']>,
    ParentType,
    ContextType,
    RequireFields<QueryStringNullableWithArgsArrayArgs, 'hello'>
  >;
  object?: Resolver<Maybe<ResolversTypes['Human']>, ParentType, ContextType>;
  objectArray?: Resolver<
    Maybe<Array<Maybe<ResolversTypes['Human']>>>,
    ParentType,
    ContextType
  >;
  objectWithArgs?: Resolver<
    ResolversTypes['Human'],
    ParentType,
    ContextType,
    RequireFields<QueryObjectWithArgsArgs, 'who'>
  >;
  arrayString?: Resolver<
    Array<ResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  arrayObjectArgs?: Resolver<
    Array<ResolversTypes['Human']>,
    ParentType,
    ContextType,
    RequireFields<QueryArrayObjectArgsArgs, 'limit'>
  >;
  greetings?: Resolver<
    ResolversTypes['GreetingsEnum'],
    ParentType,
    ContextType
  >;
  giveGreetingsInput?: Resolver<
    ResolversTypes['String'],
    ParentType,
    ContextType,
    RequireFields<QueryGiveGreetingsInputArgs, 'input'>
  >;
  number?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type MutationResolvers<
  ContextType = any,
  ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']
> = {
  increment?: Resolver<
    ResolversTypes['Int'],
    ParentType,
    ContextType,
    RequireFields<MutationIncrementArgs, 'n'>
  >;
};

export type HumanResolvers<
  ContextType = any,
  ParentType extends ResolversParentTypes['Human'] = ResolversParentTypes['Human']
> = {
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  father?: Resolver<ResolversTypes['Human'], ParentType, ContextType>;
  fieldWithArgs?: Resolver<
    ResolversTypes['Int'],
    ParentType,
    ContextType,
    RequireFields<HumanFieldWithArgsArgs, 'id'>
  >;
  sons?: Resolver<
    Maybe<Array<ResolversTypes['Human']>>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type Resolvers<ContextType = any> = {
  ExampleScalar?: GraphQLScalarType;
  Query?: QueryResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  Human?: HumanResolvers<ContextType>;
};

/**
 * @deprecated
 * Use "Resolvers" root object instead. If you wish to get "IResolvers", add "typesPrefix: I" to your config.
 */
export type IResolvers<ContextType = any> = Resolvers<ContextType>;

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
}
