import { redirect } from "next/navigation";

import { LoginForm } from "./LoginForm";
import { getCurrentUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-md bg-slate-800 text-lg font-bold text-white">
            B
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            BSVgo CMS
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            登录后管理文章、分类标签和发布状态。
          </p>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
