class ArrayType<TType extends Type<unknown, unknown> = Type<unknown, unknown>, Args = undefined> {
  type: TType;
  argsType: Args = undefined as any;
  public hasArgs = false;

  constructor(type: TType, hasArgs: boolean = false) {
    this.type = type;
    this.hasArgs = hasArgs;
  }
}

class Type<Value, Args = undefined> {
  typeString: string;
  valueType: Value = undefined as any;
  argsType: Args = undefined as any;
  hasArgs = false;
  includedTypes: Record<string, true> | undefined;

  constructor(typeString: string, hasArgs: boolean = false, ...includedTypes: string[]) {
    this.typeString = typeString;
    this.hasArgs = hasArgs;

    if (includedTypes.length) {
      this.includedTypes = {};
      for (const key of includedTypes) {
        this.includedTypes[key] = true;
      }
    }
  }
}

const A = new Type<{
  a: string;
  b: number;
}>("A", false, "a", "b");

const StringType = new Type<string>("String");

const Hello = new Type<{
  d: string;
  aType: typeof A;
}>("Hello", false, "d");

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
    >(StringType),
    HelloWithArgs: new Type<typeof Hello["valueType"], { d: number }>("HelloWithArgs"),
    ArrayHello: new ArrayType(Hello),
    ArrayHelloWithArgs: new ArrayType<
      typeof Hello,
      {
        d: number;
      }
    >(Hello),
  },
  A,
  Hello,
} as const;

type ConvertSchema<T> = {
  [P in keyof T]: T[P] extends Type<unknown, object>
    ? (args?: T[P]["argsType"]) => T[P]["valueType"]
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
  return new Proxy(v, {
    get(target: any, key: string | number, receiver) {
      let type: Type<unknown, unknown> | undefined;

      keys.push(key);

      console.log("88 keys", keys);

      if (target instanceof ArrayType || target instanceof Type) {
        if (target instanceof ArrayType) {
          console.log(92, "array type!");
          type = target.type;
        } else {
          type = target;
        }
        if (target.hasArgs) {
          return (args: any) => {
            console.log("args", args);
            return createProxy(value);
          };
        }
      }

      console.log(104, type);

      const value = target[key];

      if (type && type.includedTypes?.[key]) {
        // TODO Value from cache here

        console.log("VALUE FROM CACHE");

        return null;
      }

      if (target instanceof ArrayType) {
        console.log(116);
        return createProxy([value]);
      }
      console.log(119);

      return createProxy(value);

      return Reflect.get(target, key, receiver);
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
  }).d
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
  console.log(v.d);
});
