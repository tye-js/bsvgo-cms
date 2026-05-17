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

function getErrorCode(error: unknown) {
  const candidates = [
    error,
    typeof error === "object" && error ? (error as { cause?: unknown }).cause : null
  ];

  for (const candidate of candidates) {
    if (
      typeof candidate === "object" &&
      candidate &&
      "code" in candidate &&
      typeof (candidate as { code?: unknown }).code === "string"
    ) {
      return (candidate as { code: string }).code;
    }
  }

  return "unknown";
}

function loginUnavailable(error: unknown): LoginState {
  console.error(
    `Login failed because auth storage is unavailable: ${getErrorCode(error)}`
  );
  return {
    error: "当前无法登录。请检查数据库配置后重试。"
  };
}

export async function loginAction(
  _previousState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "登录信息无效" };
  }

  try {
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
      return { error: "邮箱或密码错误" };
    }

    const isValid = await verifyPassword(user.password, parsed.data.password);
    if (!isValid) {
      return { error: "邮箱或密码错误" };
    }

    await createSession(user.id);
  } catch (error) {
    return loginUnavailable(error);
  }

  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
