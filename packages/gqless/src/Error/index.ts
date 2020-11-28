import type { GraphQLError } from 'graphql';

export class gqlessError extends Error {
  graphQLErrors?: ReadonlyArray<GraphQLError>;
  otherError?: unknown;

  constructor(
    message: string,
    {
      graphQLErrors,
      otherError,
    }: {
      graphQLErrors?: gqlessError['graphQLErrors'];
      otherError?: gqlessError['otherError'];
    } = {}
  ) {
    super(message);

    if (graphQLErrors) this.graphQLErrors = graphQLErrors;
    if (otherError !== undefined) this.otherError = otherError;
  }

  toJSON() {
    return {
      message: this.message,
      graphQLErrors: this.graphQLErrors,
      otherError: this.otherError,
    };
  }

  static create(error: unknown): gqlessError {
    if (error instanceof gqlessError) return error;

    if (error instanceof Error) {
      return Object.assign(new gqlessError(error.message), error);
    }

    return new gqlessError('Unexpected error type', {
      otherError: error,
    });
  }
}
