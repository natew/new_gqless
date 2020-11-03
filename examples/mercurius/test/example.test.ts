import { createMercuriusTestClient } from "mercurius-integration-testing";
import tap from "tap";

import { app } from "../src";
import { client as generatedClient, resolved } from "../src/generated";

const testClient = createMercuriusTestClient(app);

tap.test("works", async (t) => {
  t.plan(2);

  await testClient
    .query(
      `
    query {
        simpleString
    }
    `
    )
    .then((response) => {
      t.type(response.data?.simpleString, "string");
    });

  await testClient
    .query(
      `
    query {
      arrayObjectArgs(limit: 2) {
        name
        father {
          name
          father {
            name
          }
        }
      }
    }
  `
    )
    .then((resp) => {
      t.equals(resp.errors, undefined);
    });
});

tap.test("multiple args", async (t) => {
  const response = await testClient.query(`
  query {
    a1: objectWithArgs(who: "hello") {
      zxc: name
      abc: name
    }
    a2: objectWithArgs(who: "hello2") {
      name
    }
  }
  `);

  t.equivalent(response, {
    data: {
      a1: {
        zxc: "hello",
        abc: "hello",
      },
      a2: {
        name: "hello2",
      },
    },
  });

  t.done();
});

tap
  .test("generatedClient", async (t) => {
    const anon = generatedClient.query.objectWithArgs({
      who: "anon",
    });

    const { name, fatherName } = await resolved(() => {
      return {
        name: anon.name,
        fatherName: anon.father.father.name,
      };
    });

    t.type(name, "string");
    t.type(fatherName, "string");

    t.type(anon.name, "string");
    t.type(anon.father.father.name, "string");

    const arrayDataAfterResolved = await resolved(() => {
      return generatedClient.query.objectArray.map((v) => v.name);
    });

    t.assert(arrayDataAfterResolved.length > 0);
    t.equals(
      arrayDataAfterResolved.every((v) => typeof v === "string" && v.length > 30),
      true
    );

    t.done();
  })
  .then(() => {
    tap.test("args", async (t) => {
      const name = await resolved(
        () =>
          generatedClient.query.objectWithArgs({
            who: "asd",
          }).name
      );

      t.equal(name, "asd");

      t.done();
    });
  });

tap.test("refetch works", async (t) => {
  const firstHumanName = await resolved(
    () => {
      return generatedClient.query.object.name;
    },
    {
      refetch: true,
    }
  );

  t.assert(firstHumanName.length > 20);

  const secondHumanName = await resolved(
    () => {
      return generatedClient.query.object.name;
    },
    {
      refetch: true,
    }
  );

  t.assert(secondHumanName.length > 20);

  t.assert(firstHumanName !== secondHumanName, "Both names are different");

  t.done();
});
