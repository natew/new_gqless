// Based on https://github.com/mercurius-js/mercurius/blob/master/lib/subscription-client.js

import { GraphQLError } from 'graphql';
import WebSocket from 'isomorphic-ws';

import { createDeferredPromise, DeferredPromise, GQLResponse } from '../utils';
import {
  GQL_COMPLETE,
  GQL_CONNECTION_ACK,
  GQL_CONNECTION_ERROR,
  GQL_CONNECTION_INIT,
  GQL_CONNECTION_KEEP_ALIVE,
  GQL_DATA,
  GQL_ERROR,
  GQL_START,
  GQL_STOP,
  GRAPHQL_WS,
} from './protocol';

type Operation = {
  started: boolean;
  options: {
    query: string;
    variables?: Record<string, unknown>;
  };
  handler: (data: GQLResponse | null) => Promise<void>;
  extensions?: { type: string; payload: unknown }[];
};

export interface ClientOptions {
  reconnect?: boolean;
  maxReconnectAttempts?: number;
  serviceName?: string;
  connectionCallback?: () => void;
  failedConnectionCallback?: (payload: unknown) => Promise<void>;
  failedReconnectCallback?: () => void;
  connectionInitPayload?: Record<string, unknown>;
  headers?: Record<string, string>;
}

// This class is already being tested in https://github.com/mercurius-js/mercurius/blob/master/test/subscription-client.js
export class Client {
  subscriptionQueryMap: Record<string, string>;
  reverseSubscriptionQueryMap: Record<string, string>;

  socket: WebSocket | null;
  headers;
  uri;
  operationId;
  ready;
  operations: Map<string, Operation>;
  operationsCount: Record<string | number, number>;
  tryReconnect;
  maxReconnectAttempts;
  reconnectAttempts;
  connectionCallback;
  failedConnectionCallback;
  failedReconnectCallback;
  connectionInitPayload?: unknown;
  closedByUser?: boolean;
  reconnecting?: boolean;
  reconnectTimeoutId?: ReturnType<typeof setTimeout>;

  connectedPromise: DeferredPromise<void>;

  constructor(
    uri: string,
    {
      headers = {},
      reconnect = true,
      maxReconnectAttempts = Infinity,
      connectionCallback,
      failedConnectionCallback,
      failedReconnectCallback,
      connectionInitPayload = {},
    }: ClientOptions
  ) {
    this.uri = uri;
    this.socket = null;
    this.operationId = 0;
    this.ready = false;
    this.operations = new Map();
    this.operationsCount = {};

    this.subscriptionQueryMap = {};
    this.reverseSubscriptionQueryMap = {};

    this.headers = headers;
    this.tryReconnect = reconnect;
    this.maxReconnectAttempts = maxReconnectAttempts;
    this.reconnectAttempts = 0;
    this.connectionCallback = connectionCallback;
    this.failedConnectionCallback = failedConnectionCallback;
    this.failedReconnectCallback = failedReconnectCallback;
    this.connectionInitPayload = connectionInitPayload;

    this.connect();

    this.connectedPromise = createDeferredPromise();
  }

  connect() {
    this.socket = new WebSocket(this.uri, [GRAPHQL_WS], {
      headers: this.headers,
    });

    this.socket.onopen = async () => {
      /* istanbul ignore else */
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        try {
          const payload =
            typeof this.connectionInitPayload === 'function'
              ? await this.connectionInitPayload()
              : this.connectionInitPayload;
          this.sendMessage(null, GQL_CONNECTION_INIT, payload);
        } catch (err) {
          this.close(this.tryReconnect, false);
        }
      }
    };

    this.socket.onclose = () => {
      if (!this.closedByUser) {
        this.close(this.tryReconnect, false);
      }
    };

    this.socket.onerror = () => {};

    this.socket.onmessage = async ({ data }) => {
      await this.handleMessage(data.toString('utf-8'));
    };
  }

  close(tryReconnect = false, closedByUser = true) {
    this.closedByUser = closedByUser;
    this.ready = false;
    this.connectedPromise.reject(Error('Socket closed!'));
    this.connectedPromise = createDeferredPromise();

    if (this.socket !== null) {
      if (closedByUser) {
        this.unsubscribeAll();
      }

      this.socket.close();
      this.socket = null;
      this.reconnecting = false;

      if (tryReconnect) {
        for (const operationId of this.operations.keys()) {
          const operation = this.operations.get(operationId);

          if (operation) {
            const { options, handler, extensions } = operation;

            this.operations.set(operationId, {
              options,
              handler,
              extensions,
              started: false,
            });
          }
        }

        this.reconnect();
      } else {
      }
    }
  }

  getReconnectDelay() {
    const delayMs = 100 * Math.pow(2, this.reconnectAttempts);

    return Math.min(delayMs, 10000);
  }

  reconnect() {
    if (
      this.reconnecting ||
      this.reconnectAttempts > this.maxReconnectAttempts
    ) {
      return this.failedReconnectCallback && this.failedReconnectCallback();
    }

    this.reconnectAttempts++;
    this.reconnecting = true;

    const delay = this.getReconnectDelay();

    this.reconnectTimeoutId = setTimeout(() => {
      this.connect();
    }, delay);
  }

  async unsubscribe(operationId: string | number, forceUnsubscribe = false) {
    let count = this.operationsCount[operationId];
    count--;

    if (count === 0 || forceUnsubscribe) {
      await this.sendMessage(operationId, GQL_STOP, null);
      this.operationsCount[operationId] = 0;
      delete this.subscriptionQueryMap[
        this.reverseSubscriptionQueryMap[operationId]
      ];
    } else {
      this.operationsCount[operationId] = count;
    }
  }

  unsubscribeAll() {
    for (const operationId of this.operations.keys()) {
      this.unsubscribe(operationId, true).catch(console.error);
    }
  }

  sendMessage(
    operationId: number | string | null,
    type: string,
    payload: unknown = {},
    extensions?: unknown
  ) {
    return new Promise<void>((resolve, reject) => {
      try {
        if (!this.socket) return reject(Error('No socket available'));

        this.socket.send(
          JSON.stringify({
            id: operationId,
            type,
            payload,
            extensions,
          }),
          (err) => {
            if (err) {
              return reject(err);
            }
            resolve();
          }
        );
      } catch (err) {
        reject(err);
      }
    });
  }

  async handleMessage(message: string) {
    let data;
    let operationId;
    let operation;

    try {
      data = JSON.parse(message);
      operationId = data.id;
    } catch (e) {
      /* istanbul ignore next */
      throw new Error(
        `Invalid message received: "${message}" Message must be JSON parsable.`
      );
    }

    if (operationId) {
      operation = this.operations.get(operationId);
    }

    switch (data.type) {
      case GQL_CONNECTION_ACK:
        this.reconnecting = false;
        this.ready = true;
        this.reconnectAttempts = 0;
        this.connectedPromise.resolve();

        for (const operationId of this.operations.keys()) {
          this.startOperation(operationId).catch(console.error);
        }

        if (this.connectionCallback) {
          this.connectionCallback();
        }

        break;
      case GQL_DATA:
        /* istanbul ignore else */
        if (operation) {
          // previously it was "operation.handler(data.payload.data);"
          // but that doesn't allow for resolver error handling
          operation.handler(data.payload);
        }
        break;
      case GQL_ERROR:
        /* istanbul ignore else */
        if (operation) {
          operation.handler({
            data: null,
            errors: [new GraphQLError(data.payload)],
          });
          this.operations.delete(operationId);
          this.sendMessage(operationId, GQL_ERROR, data.payload).catch(
            console.error
          );
        }
        break;
      case GQL_COMPLETE:
        /* istanbul ignore else */
        if (operation) {
          operation.handler(null);
          this.operations.delete(operationId);
        }

        break;
      case GQL_CONNECTION_ERROR:
        this.close(this.tryReconnect, false);
        if (this.failedConnectionCallback) {
          await this.failedConnectionCallback(data.payload);
        }
        break;
      case GQL_CONNECTION_KEEP_ALIVE:
        break;
      /* istanbul ignore next */
      default:
        /* istanbul ignore next */
        throw new Error(`Invalid message type: "${data.type}"`);
    }
  }

  async startOperation(operationId: string) {
    const operation = this.operations.get(operationId);
    if (!operation) throw Error('Operation not found, ' + operationId);

    const { started, options, handler, extensions } = operation;

    if (!started) {
      await this.connectedPromise.promise;

      if (!this.ready) {
        throw new Error('Connection is not ready');
      }
      this.operations.set(operationId, {
        started: true,
        options,
        handler,
        extensions,
      });
      return this.sendMessage(operationId, GQL_START, options, extensions);
    }
    return Promise.resolve();
  }

  async createSubscription(
    query: string,
    variables: Record<string, unknown> | undefined,
    publish: (args: {
      topic: string;
      payload: GQLResponse | null;
    }) => void | Promise<void>,
    subscriptionString?: string
  ) {
    subscriptionString ||= JSON.stringify({
      query,
      variables,
    });

    let operationId = this.subscriptionQueryMap[subscriptionString];

    if (operationId && this.operations.get(operationId)) {
      this.operationsCount[operationId] = this.operationsCount[operationId] + 1;
      return operationId;
    }

    operationId = String(++this.operationId);

    const operation: Operation = {
      started: false,
      options: { query, variables },
      handler: async (data) => {
        await publish({
          topic: operationId,
          payload: data,
        });
      },
    };

    this.operations.set(operationId, operation);
    const startPromise = this.startOperation(operationId);
    this.operationsCount[operationId] = 1;

    this.subscriptionQueryMap[subscriptionString] = operationId;
    this.reverseSubscriptionQueryMap[operationId] = subscriptionString;

    await startPromise;

    return operationId;
  }
}
