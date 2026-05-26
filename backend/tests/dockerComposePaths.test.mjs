import { test } from "node:test";
import assert from "node:assert/strict";
import {
  relativePathIsRootDockerCompose,
  zipEntryIsRootDockerCompose,
  uploadBasenamesIncludeRootDockerCompose,
} from "../utils/dockerComposePaths.js";

test("relativePathIsRootDockerCompose accepte la racine", () => {
  assert.equal(relativePathIsRootDockerCompose("docker-compose.yml"), true);
  assert.equal(relativePathIsRootDockerCompose("docker-compose.yaml"), true);
  assert.equal(relativePathIsRootDockerCompose("src/docker-compose.yml"), false);
});

test("zipEntryIsRootDockerCompose exige la racine du ZIP", () => {
  assert.equal(zipEntryIsRootDockerCompose("docker-compose.yml"), true);
  assert.equal(zipEntryIsRootDockerCompose("app/docker-compose.yml"), false);
});

test("uploadBasenamesIncludeRootDockerCompose", () => {
  assert.equal(
    uploadBasenamesIncludeRootDockerCompose(["readme.md", "docker-compose.yml"]),
    true
  );
  assert.equal(uploadBasenamesIncludeRootDockerCompose(["nested/docker-compose.yml"]), false);
});
