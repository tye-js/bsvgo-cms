import { migrate } from "drizzle-orm/postgres-js/migrator";

import { closeDb, db } from "../src/server/db";

async function main() {
  await migrate(db, {
    migrationsFolder: "drizzle",
    migrationsSchema: "bsvgo_cms_admin",
    migrationsTable: "__drizzle_migrations"
  });
  console.log("Admin compatibility migration complete");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
