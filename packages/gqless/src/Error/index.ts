import type { GraphQLError } from 'graphql';

export class gqlessError extends Error {
  networkError?: Error;
  graphQLErrors?: ReadonlyArray<GraphQLError>;
  otherReason?: unknown;

  static create(error: unknown): gqlessError {
    if (error instanceof gqlessError) return error;

    if (error instanceof Error) {
      return Object.assign(new gqlessError(), error);
    }

    return Object.assign<gqlessError, Partial<gqlessError>>(
      new gqlessError('Unexpected error'),
      {
        otherReason: error,
      }
    );
  }
}
