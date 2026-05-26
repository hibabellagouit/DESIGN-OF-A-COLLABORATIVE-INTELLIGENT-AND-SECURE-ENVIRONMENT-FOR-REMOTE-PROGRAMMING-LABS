import { test } from "node:test";
import assert from "node:assert/strict";
import { parseComposePsRows } from "../utils/composeLogSummary.js";
import { parseHostPortFromComposePortOutput } from "../utils/composeLogSummary.js";

test("parseComposePsRows accepte un tableau JSON sur une ligne", () => {
  const rows = parseComposePsRows(
    '[{"Service":"frontend","Publishers":[{"URL":"http://127.0.0.1:49152","PublishedPort":49152,"TargetPort":80}]}]'
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].Service, "frontend");
});

test("parseHostPortFromComposePortOutput", () => {
  assert.equal(parseHostPortFromComposePortOutput("0.0.0.0:32768\n"), 32768);
  assert.equal(parseHostPortFromComposePortOutput(":32768"), 32768);
});
