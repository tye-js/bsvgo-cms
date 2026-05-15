import { eq, sql } from "drizzle-orm";

import { verifyPassword } from "../src/server/auth/password";
import { closeDb, db } from "../src/server/db";
import { sessions, users } from "../src/server/db/schema";

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@bsvgo.com";
  const password = process.env.ADMIN_PASSWORD ?? "";

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      password: users.password,
      role: users.role,
      deletedAt: users.deletedAt
    })
    .from(users)
    .where(eq(sql`lower(${users.email})`, email.toLowerCase()))
    .limit(1);

  if (!user) {
    throw new Error("Admin user not found");
  }

  const [sessionSummary] = await db
    .select({ sessions: sql<number>`count(*)` })
    .from(sessions);

  const passwordValid = await verifyPassword(user.password, password);

  console.log(
    JSON.stringify(
      {
        email: user.email,
        role: user.role,
        deleted: Boolean(user.deletedAt),
        passwordValid,
        sessions: Number(sessionSummary.sessions)
      },
      null,
      2
    )
  );

  if (!passwordValid) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await closeDb();
});
