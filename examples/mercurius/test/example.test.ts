import { buildQuery } from "gqless";
import { createMercuriusTestClient } from "mercurius-integration-testing";
import tap from "tap";

import { app } from "../src";
import {
  client as generatedClient,
  globalSelections,
  resolveAllSelections,
} from "../src/generated";

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

tap.test("generatedClient", async (t) => {
  const anon = generatedClient.query.objectWithArgs({
    who: "anon",
  });

  anon.name;
  anon.father.father.name;

  const { query, variables } = buildQuery(globalSelections, true);

  const { data, errors } = await testClient.query(query, {
    variables,
  });

  t.equal(errors, undefined);

  t.type(data?.objectWithArgs.father.father.name, "string");
  t.type(data?.objectWithArgs.name, "string");

  t.equal(anon.name, null, "69");
  t.equal(anon.father.father.name, null, "70");

  await resolveAllSelections();

  t.type(anon.name, "string", "74");
  t.type(anon.father.father.name, "string", "75");

  t.equal(globalSelections.size, 0);

  const arrayData = generatedClient.query.objectArray.map((v) => v.name);

  t.equivalent(arrayData, [null]);

  await resolveAllSelections();

  const arrayDataAfterResolved = generatedClient.query.objectArray.map((v) => v.name);

  t.assert(arrayDataAfterResolved.length > 0);
  t.equals(
    arrayDataAfterResolved.every((v) => typeof v === "string" && v.length > 30),
    true
  );

  t.done();
});
