import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  patchComposeContentForSandbox,
  isPortBindConflict,
  composeBuildLikelySucceeded,
} from "../utils/sandboxComposePatch.js";

describe("sandboxComposePatch", () => {
  it("rewrites fixed host ports to dynamic", () => {
    const yml = `services:
  web:
    ports:
      - "3000:3000"
`;
    const out = patchComposeContentForSandbox(yml);
    assert.match(out, /0:3000/);
    assert.doesNotMatch(out, /3000:3000/);
  });

  it("detects port bind conflict", () => {
    assert.ok(
      isPortBindConflict("Bind for 0.0.0.0:3000 failed: port is already allocated")
    );
  });

  it("detects successful build in logs", () => {
    assert.ok(composeBuildLikelySucceeded("", "Image sandbox-backend Built"));
  });
});
