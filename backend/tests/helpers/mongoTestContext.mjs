import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import SecurityPolicy from "../../models/SecurityPolicy.js";

let mongod;
let usedMemoryServer = false;

function resolveTestUri() {
  if (process.env.MONGODB_URI_TEST) return process.env.MONGODB_URI_TEST;
  if (process.env.CI === "true" || process.env.CI === "1") {
    return process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/tp_projets_integration";
  }
  return null;
}

export async function startTestMongo() {
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }

  const externalUri = resolveTestUri();
  if (externalUri) {
    usedMemoryServer = false;
    process.env.MONGODB_URI = externalUri;
    await mongoose.connect(externalUri);
    return;
  }

  if (process.env.INTEGRATION_USE_MEMORY_MONGO !== "true") {
    throw new Error(
      "Tests d’intégration : définissez MONGODB_URI_TEST (Mongo local/CI) " +
        "ou INTEGRATION_USE_MEMORY_MONGO=true (télécharge un binaire Mongo en mémoire, ~150 Mo)."
    );
  }

  usedMemoryServer = true;
  mongod = await MongoMemoryServer.create({
    binary: { version: "6.0.14" },
  });
  const uri = mongod.getUri();
  process.env.MONGODB_URI = uri;
  await mongoose.connect(uri);
}

export async function ensureDefaultSecurityPolicy() {
  await SecurityPolicy.findOneAndUpdate(
    { key: "default" },
    { $setOnInsert: { key: "default" }, $set: { allowStudentSelfRegistration: true } },
    { upsert: true, new: true }
  );
}

export async function clearCollections() {
  const { collections } = mongoose.connection;
  for (const col of Object.values(collections)) {
    await col.deleteMany({});
  }
  await ensureDefaultSecurityPolicy();
}

export async function stopTestMongo() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (usedMemoryServer && mongod) {
    await mongod.stop();
    mongod = null;
  }
  usedMemoryServer = false;
}
