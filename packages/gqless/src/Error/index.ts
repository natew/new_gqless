import type { GraphQLError } from 'graphql';

export class gqlessError extends Error {
  graphQLErrors?: ReadonlyArray<GraphQLError>;
  otherError?: unknown;

  constructor(
    message: string,
    {
      graphQLErrors,
      otherError,
      caller,
    }: {
      graphQLErrors?: gqlessError['graphQLErrors'];
      otherError?: gqlessError['otherError'];
      caller?: Function;
    } = {}
  ) {
    super(message);

    if (graphQLErrors) this.graphQLErrors = graphQLErrors;
    if (otherError !== undefined) this.otherError = otherError;

    /* istanbul ignore else */
    if (caller && Error.captureStackTrace!)
      Error.captureStackTrace(this, caller);
  }

  toJSON() {
    return {
      message: this.message,
      graphQLErrors: this.graphQLErrors,
      otherError: this.otherError,
    };
  }

  static create(error: unknown, caller?: Function): gqlessError {
    const newError = (() => {
      if (error instanceof gqlessError) return error;

      if (error instanceof Error) {
        return Object.assign(new gqlessError(error.message), error);
      }

      return new gqlessError('Unexpected error type', {
        otherError: error,
      });
    })();

    /* istanbul ignore else */
    if (caller && Error.captureStackTrace!) {
      Error.captureStackTrace(newError, caller);
    }

    return newError;
  }
}
