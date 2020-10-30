export class ArrayType<T extends Type<unknown, unknown>, Args = undefined> {
  public type: T;
  public hasArgs = false;
  declare argsType: Args;

  constructor(type: T, hasArgs: boolean = false) {
    this.type = type;
    this.hasArgs = hasArgs;
  }
}

class Type<Value, Args = undefined> {
  typeString: string;
  declare valueType: Value;
  declare argsType: Args;

  hasArgs = false;
  includedTypes: Record<string, Type<unknown, unknown>> | undefined;

  constructor(
    typeString: string,
    hasArgs: boolean = false,
    types?: Record<string, Type<unknown, unknown>>
  ) {
    this.typeString = typeString;
    this.hasArgs = hasArgs;

    const typesEntries = types ? Object.entries(types) : [];

    if (typesEntries.length) {
      this.includedTypes = {};
      for (const [name, type] of typesEntries) {
        this.includedTypes[name] = type;
      }
    }
  }
}

const StringType = new Type<string>("String");

const A = new Type<{
  a: string;
  b: number;
}>("A", false, { a: StringType });

const Hello = new Type<{
  d: string;
  aType: typeof A;
}>("Hello", false, {
  d: StringType,
  aType: A,
});

const schema = {
  Query: {
    Hello,
    ArrayQuery: new ArrayType(StringType),
    ArrayQueryObject: new ArrayType(A),
    ArrayWithArgs: new ArrayType<
      typeof StringType,
      {
        a: string;
      }
    >(StringType, true),
    HelloWithArgs: new Type<typeof Hello["valueType"], { d: number }>("HelloWithArgs", true, {
      d: StringType,
      aType: A,
    }),
    ArrayHello: new ArrayType(Hello),
    ArrayHelloWithArgs: new ArrayType<
      typeof Hello,
      {
        d: number;
      }
    >(Hello, true),
  },
  A,
  Hello,
} as const;

type ConvertSchema<T> = {
  [P in keyof T]: T[P] extends Type<unknown, object>
    ? (args?: T[P]["argsType"]) => ConvertSchema<T[P]["valueType"]>
    : T[P] extends Type<unknown, undefined>
    ? ConvertSchema<T[P]["valueType"]>
    : T[P] extends ArrayType<Type<unknown, unknown>, object>
    ? (args?: T[P]["argsType"]) => Array<ConvertSchema<T[P]["type"]["valueType"]>>
    : T[P] extends ArrayType<Type<unknown, unknown>, undefined>
    ? Array<ConvertSchema<T[P]["type"]["valueType"]>>
    : ConvertSchema<T[P]>;
};

const keys: unknown[] = [];

const createProxy = <T extends object>(v: T): T => {
  if (typeof v !== "object") return v;
  return new Proxy(v, {
    get(target: any, key: string | number, receiver) {
      keys.push(key);

      const value =
        target[key] ??
        (() => {
          if (target instanceof Type) {
            const type = target.includedTypes?.[key];
            if (type) {
              return type;
            }
            return undefined;
          } else if (target instanceof ArrayType) {
            const type = target.type.includedTypes?.[key];
            if (type) {
              return type;
            }
          }
          return undefined;
        })();

      if ((value instanceof Type || value instanceof ArrayType) && value.hasArgs) {
        return (args: any) => {
          console.log("args", args);
          return createProxy(value);
        };
      }

      if (target instanceof ArrayType) {
        console.log(127, {
          target,
          value,
          key,
        });
        return [createProxy(value)][key as any];
      }

      if (typeof value === "object") {
        return createProxy(value);
      }

      return value;
    },
  });
};

const createClient = <T extends object>(schema: T) => {
  const proxy = createProxy(schema);
  return proxy as ConvertSchema<T>;
};

const client = createClient(schema);

console.log(31, client.Query.Hello.d);

client.Query.Hello.aType.a;

console.log("keys", keys);

keys.splice(0, keys.length);

console.log(44, client.Query.ArrayQuery);

console.log(
  46,
  client.Query.ArrayQuery.map((v) => {
    console.log(53, v);
    return v;
  })
);

console.log("keys", keys);
keys.splice(0, keys.length);

client.Query.HelloWithArgs;

console.log(
  60,
  client.Query.HelloWithArgs({
    d: 456,
  }).aType.a
);

console.log("keys", keys);
keys.splice(0, keys.length);

client.Query.ArrayQueryObject.map((v) => v.a);

client.Query.ArrayWithArgs({
  a: "asd",
}).map((v) => {
  console.log(v);
});

client.Query.ArrayHelloWithArgs({
  d: 123,
}).map((v) => {
  console.log(196, v.d);
});
