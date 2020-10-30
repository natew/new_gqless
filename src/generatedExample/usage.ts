import { client, globalSelectionKeys } from "./client";

const printAndCleanSelectionKeys = () => {
  console.log("\n-----------------");
  console.log(`selections: \n-> ${globalSelectionKeys.join("\n-> ")}`);
  console.log("-----------------\n");
  globalSelectionKeys.splice(0, globalSelectionKeys.length);
};

printAndCleanSelectionKeys();

console.log(`client.Query.simpleString: "${client.Query.simpleString}"`);

printAndCleanSelectionKeys();

console.log(
  `client.Query.objectWithArgs({who: "xd",}).name: "${
    client.Query.objectWithArgs({
      who: "xd",
    }).name
  }"`
);

printAndCleanSelectionKeys();

console.log(`client.Query.object.name: "${client.Query.object.name}"`);

printAndCleanSelectionKeys();

console.log(`recursive human: "${client.Query.object.father.father.father.name}"`);

printAndCleanSelectionKeys();

console.log(`array strings: ${client.Query.arrayString.join("|")}`);

printAndCleanSelectionKeys();

console.log(
  `array object ${JSON.stringify(
    client.Query.objectArray.map((v) => {
      return {
        father: v.father.name,
        name: v.name,
      };
    })
  )}`
);

printAndCleanSelectionKeys();

console.log(
  `array objects fn: ${client.Query.arrayObjectArgs({
    limit: 10,
  }).map((v) => {
    return {
      a: v.father.name,
      b: v.name,
    };
  })}`
);

printAndCleanSelectionKeys();

const middleObject = client.Query.object;

middleObject.father.father.father.father.father.father.name;

middleObject.father.name;

printAndCleanSelectionKeys();
