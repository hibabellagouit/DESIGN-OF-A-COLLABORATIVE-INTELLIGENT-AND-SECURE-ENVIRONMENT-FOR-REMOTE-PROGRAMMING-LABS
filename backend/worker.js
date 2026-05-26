/**
 * Processus worker BullMQ (sandbox Docker + évaluation Ollama).
 * Lancer : npm run worker
 * Nécessite REDIS_URL et MONGODB_URI.
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./config/db.js";
import { isRedisConfigured } from "./config/redis.js";
import { startBullWorkers } from "./services/queue/bullmqJobs.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

async function main() {
  if (!isRedisConfigured()) {
    console.error("REDIS_URL manquant — impossible de démarrer le worker.");
    process.exit(1);
  }
  await connectDB();
  startBullWorkers();
  console.log("Worker en écoute (Ctrl+C pour arrêter).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
