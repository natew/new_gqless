import { buildQuery } from "gqless";
import { createMercuriusTestClient } from "mercurius-integration-testing";
import tap from "tap";

import { app } from "../src";
import { client as generatedClient, globalSelectionKeys } from "../src/generated";

const testClient = createMercuriusTestClient(app);

tap.test("works", async (t) => {
  t.plan(1);

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
    .then((resp) => console.log(JSON.stringify(resp)));
});

tap.test("generatedClient", async (t) => {
  t.plan(3);

  const anon = generatedClient.query.objectWithArgs({
    who: "anon",
  });

  anon.name;
  anon.father.father.name;

  const { query, variables } = buildQuery(globalSelectionKeys, true);

  const { data, errors } = await testClient.query(query, {
    variables,
  });

  t.equal(errors, undefined);

  t.type(data?.objectWithArgs.father.father.name, "string");
  t.type(data?.objectWithArgs.name, "string");
});
