"use server";

import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";

import { loginSchema } from "@/lib/validators";
import { createSession, destroySession } from "@/server/auth/session";
import { verifyPassword } from "@/server/auth/password";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";

export type LoginState = {
  error?: string;
};

export async function loginAction(
  _previousState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid login details" };
  }

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      password: users.password,
      deletedAt: users.deletedAt
    })
    .from(users)
    .where(eq(sql`lower(${users.email})`, parsed.data.email.toLowerCase()))
    .limit(1);

  if (!user || user.deletedAt) {
    return { error: "Invalid email or password" };
  }

  const isValid = await verifyPassword(user.password, parsed.data.password);
  if (!isValid) {
    return { error: "Invalid email or password" };
  }

  await createSession(user.id);
  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
