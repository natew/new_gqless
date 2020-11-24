import { createClient } from '../Client';
import { gqlessError } from '../Error';

type EventType<D> =
  | { type: 'fetching' }
  | { type: 'data'; data: D }
  | { type: 'error'; error: gqlessError };

export class Poller<D> {
  private __data: D | undefined;

  private __isFetching = false;

  private __isPolling = false;

  private interval?: any;

  private __pollInterval: number;

  private subscribers = new Set<(event: EventType<D>) => void>();

  constructor(
    public pollFn: (() => D) | { current: () => D },
    intervalMS: number,
    private client: ReturnType<typeof createClient>
  ) {
    this.__pollInterval = intervalMS;
  }

  private sendEventToSubscribers(event: EventType<D>) {
    this.subscribers.forEach((subscriberFn) => subscriberFn(event));
  }

  start() {
    this.__isPolling = true;
    clearInterval(this.interval);
    this.interval = setInterval(() => {
      if (!this.__isFetching) {
        this.__isFetching = true;
        this.sendEventToSubscribers({
          type: 'fetching',
        });

        this.client
          .refetch(
            typeof this.pollFn === 'object' ? this.pollFn.current : this.pollFn
          )
          .then(
            (data) => (this.data = data),
            (err) => {
              this.sendEventToSubscribers({
                type: 'error',
                error: gqlessError.create(err),
              });
            }
          )
          .finally(() => {
            this.__isFetching = false;
          });
      }
    }, this.__pollInterval) as any;
  }

  stop() {
    clearInterval(this.interval);
    this.__isPolling = false;
  }

  subscribe(subscriptionFn: (event: EventType<D>) => void) {
    const subscribers = this.subscribers;
    subscribers.add(subscriptionFn);

    return function unsubscribe() {
      subscribers.delete(subscriptionFn);
    };
  }

  get isPolling() {
    return this.__isPolling;
  }

  get data() {
    return this.__data;
  }

  set data(data: D | undefined) {
    this.__data = data;
    if (data) {
      this.sendEventToSubscribers({
        type: 'data',
        data,
      });
    }
  }

  set pollInterval(v: number) {
    const didChange = this.__pollInterval !== v;
    this.__pollInterval = v;
    if (didChange && this.__isPolling) {
      this.stop();
      this.start();
    }
  }

  get pollInterval() {
    return this.__pollInterval;
  }
}

//@ts-expect-error
const asd = new Poller();
