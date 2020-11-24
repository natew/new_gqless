import type { GraphQLError } from 'graphql';

export class gqlessError extends Error {
  networkError?: Error;
  graphQLErrors?: ReadonlyArray<GraphQLError>;
  otherError?: unknown;

  constructor(
    message: string,
    {
      networkError,
      graphQLErrors,
      otherReason,
    }: {
      networkError?: gqlessError['networkError'];
      graphQLErrors?: gqlessError['graphQLErrors'];
      otherReason?: gqlessError['otherError'];
    } = {}
  ) {
    super(message);

    this.networkError = networkError;
    this.graphQLErrors = graphQLErrors;
    this.otherError = otherReason;
  }

  toJSON() {
    return {
      message: this.message,
      graphQLErrors: this.graphQLErrors,
      networkError: this.networkError,
      otherError: this.otherError,
    };
  }

  static create(error: unknown): gqlessError {
    if (error instanceof gqlessError) return error;

    if (error instanceof Error) {
      return Object.assign(new gqlessError(error.message), error);
    }

    return new gqlessError('Unexpected error type', {
      otherReason: error,
    });
  }
}
