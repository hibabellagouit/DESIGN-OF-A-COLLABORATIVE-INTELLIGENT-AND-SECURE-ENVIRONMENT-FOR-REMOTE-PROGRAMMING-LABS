import test from "node:test";
import assert from "node:assert/strict";
import {
  parseComposeAccessLinks,
  parseHostPortFromComposePortOutput,
  mergeComposeAccessLinks,
} from "../utils/composeLogSummary.js";

test("parseComposeAccessLinks lit les ports publiés", () => {
  const ps = `{"Service":"backend","Ports":"0.0.0.0:49152->3000/tcp"}
{"Service":"frontend","Ports":"0.0.0.0:49153->80/tcp"}`;
  const links = parseComposeAccessLinks(ps);
  assert.equal(links.length, 2);
  assert.equal(links[0].url, "http://127.0.0.1:49152");
  assert.equal(links[0].containerPort, 3000);
});

test("parseComposeAccessLinks ignore PublishedPort 0 et URL 0.0.0.0", () => {
  const ps = `{"Service":"backend","Publishers":[{"URL":"http://0.0.0.0","TargetPort":3000,"PublishedPort":0}]}`;
  assert.equal(parseComposeAccessLinks(ps).length, 0);
});

test("parseHostPortFromComposePortOutput", () => {
  assert.equal(parseHostPortFromComposePortOutput("0.0.0.0:49152\n"), 49152);
  assert.equal(parseHostPortFromComposePortOutput("[::]:8080"), 8080);
});

test("mergeComposeAccessLinks préfère compose port", () => {
  const merged = mergeComposeAccessLinks(
    [{ service: "backend", url: "http://0.0.0.0", hostPort: 0, containerPort: 3000 }],
    [{ service: "backend", url: "http://127.0.0.1:49152", hostPort: 49152, containerPort: 3000 }]
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0].hostPort, 49152);
});
