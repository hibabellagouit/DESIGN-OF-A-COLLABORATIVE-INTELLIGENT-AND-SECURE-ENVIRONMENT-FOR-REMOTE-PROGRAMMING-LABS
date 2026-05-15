import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import buildApp from "./app.js";
import connectDB from "./config/db.js";
import { ensureSeedAdmin } from "./bootstrap/ensureSeedAdmin.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

const PORT = process.env.PORT || 5000;
const app = buildApp();

async function start() {
  await connectDB();
  await ensureSeedAdmin();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
