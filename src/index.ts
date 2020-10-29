const schema = {
  Query: {
    Hello: {
      a: "String!",
      c: "Int!",
    },
    ArrayQuery: ["String!"],
    ArrayQueryObject: [
      {
        a: "String!",
      },
    ],
    ArrayWithArgs: [
      {
        d: "String!",
      },
      {
        a: "String!",
      },
    ],
    WithArgs: [
      {
        d: "String!",
      },
      {
        f: "String!",
        e: "Int!",
      },
    ],
  },
  A: {
    a: "String!",
  },
} as const;

schema.Query.Hello.a;

type ConvertSchema<T> = {
  [P in keyof T]: T[P] extends [unknown, object]
    ? (args?: ConvertSchema<T[P][1]>) => ConvertSchema<T[P][0]>
    : T[P] extends "String!"
    ? string
    : T[P] extends "Int!"
    ? number
    : ConvertSchema<T[P]>;
};

const keys: unknown[] = [];

const createProxy = <T extends object>(v: T): T => {
  return new Proxy(v, {
    get(target: any, key, receiver) {
      const value = target[key];

      if (target.hasOwnProperty(key)) {
        keys.push(key);
      }

      if (typeof value === "string") {
        // TODO Value from cache here
        return value;
      }
      if (typeof value === "object") {
        if ("_args" in value) {
          return (args: any) => {
            console.log("args", args);
            return createProxy(value);
          };
        }
        if ("_array" in value) {
          return createProxy([value]);
        }
        return createProxy(value);
      }

      return Reflect.get(target, key, receiver);
    },
  });
};

const createClient = <T extends object>(schema: T) => {
  const proxy = createProxy(schema);
  return proxy as ConvertSchema<T>;
};

const client = createClient(schema);

console.log(31, client.Query.Hello.c);

console.log("keys", keys);

keys.splice(0, keys.length);

console.log(
  46,
  client.Query.ArrayQuery.map((v) => {
    console.log(53, v);
    return v;
  })
);

console.log("keys", keys);
keys.splice(0, keys.length);

client.Query.WithArgs;

console.log(
  60,
  client.Query.WithArgs({
    e: 123,
    d: "asd",
  }).d
);

console.log("keys", keys);
keys.splice(0, keys.length);

client.Query.ArrayQueryObject.map((v) => v.a);

client.Query.ArrayWithArgs({
  a: "asd",
});
