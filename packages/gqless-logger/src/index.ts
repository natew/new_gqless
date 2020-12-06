import parserJSON from 'prettier/parser-babel';
import parserGraphQL from 'prettier/parser-graphql';
import prettier from 'prettier/standalone';

import { createClient } from '@dish/gqless';
import { FetchEventData } from '@dish/gqless/dist/Events';

function parseGraphQL(query: string) {
  return prettier.format(query, {
    parser: 'graphql',
    plugins: [parserGraphQL],
  });
}

function cleanObject(obj: object): object {
  return JSON.parse(JSON.stringify(obj));
}

function isTruthy<V>(v: V): v is NonNullable<V> {
  return Boolean(v);
}

const format = (...parts: Array<any[] | undefined>) => {
  const texts: string[] = [];
  const styles: string[] = [];
  for (const [text, style] of parts.filter(isTruthy)) {
    texts.push(text);
    styles.push(`font-weight: normal; ${style}`);
  }

  return [`%c${texts.join('%c')}`, ...styles];
};

export interface LoggerOptions {
  /**
   * Show selections in logs
   *
   * @default
   * true
   */
  showSelections?: boolean;
  /**
   * Show cache snapshots in logs
   *
   * @default
   * true
   */
  showCache?: boolean;
  /**
   * Stringify JSON
   *
   * @default
   * false
   */
  stringifyJSON?: boolean;
}

export function createLogger(
  client: ReturnType<typeof createClient>,
  options: LoggerOptions = {}
) {
  options = Object.assign({}, options);

  options.showCache ??= true;
  options.showSelections ??= true;
  options.stringifyJSON ??= false;

  const stringifyJSONIfEnabled = <T>(v: T) => {
    if (options.stringifyJSON) {
      return prettier.format(JSON.stringify(v), {
        parser: 'json',
        plugins: [parserJSON],
      });
    }
    return v;
  };

  const eventHandler = client.eventHandler;

  async function onFetch(dataPromise: Promise<FetchEventData>) {
    const startTime = Date.now();

    const {
      query,
      variables,
      error,
      selections,
      executionResult,
      cacheSnapshot,
      type,
    } = await dataPromise;

    const fetchTime = Date.now() - startTime;

    console.groupCollapsed(
      ...format(
        ['GraphQL ', 'color: gray'],
        [type + ' ', `color: ${error ? 'red' : '#03A9F4'}; font-weight: bold`],
        [`(${fetchTime}ms)`, 'color: gray'],
        [` ${selections.length} selections`, 'color: gray'],

        error && [
          'FAILED',
          'margin-left: 10px; border-radius: 2px; padding: 2px 6px; background: #e84343; color: white',
        ]
      )
    );

    const headerStyles = `font-weight: bold; color: #f316c1`;

    console.group(
      ...format(
        ['Query ', headerStyles],
        ['  ', `background-image: url(https://graphql.org/img/logo.svg)`]
      )
    );

    if (variables) {
      console.log(
        ...format(['Variables', 'color: #25e1e1']),
        stringifyJSONIfEnabled(variables)
      );
    }

    console.log(...format([parseGraphQL(query)]));

    console.groupEnd();

    if (error) {
      console.error(...format(['Error', headerStyles]), cleanObject(error));
    } else {
      console.log(
        ...format(['Result', headerStyles]),
        stringifyJSONIfEnabled(executionResult)
      );
    }

    if (options.showSelections) {
      console.groupCollapsed(...format(['Selections', headerStyles]));
      selections.forEach(
        ({ noIndexSelections, selectionsList, type, ...selection }) => {
          console.log(stringifyJSONIfEnabled(cleanObject(selection)));
        }
      );
      console.groupEnd();
    }

    if (options.showCache) {
      console.log(
        ...format(['Cache snapshot', headerStyles]),
        stringifyJSONIfEnabled(cacheSnapshot)
      );
      console.groupEnd();
    }
  }

  function start() {
    const unsubscribe = eventHandler.onFetchSubscribe(onFetch);

    return unsubscribe;
  }

  return {
    start,
    options,
  };
}
