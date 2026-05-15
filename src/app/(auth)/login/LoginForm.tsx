"use client";

import { useActionState } from "react";
import { Lock, Mail } from "lucide-react";

import { buttonClassName } from "@/components/admin/Button";
import { inputClassName } from "@/components/admin/Field";
import { loginAction, type LoginState } from "@/server/auth/actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="grid gap-4">
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Email
        <span className="relative">
          <Mail
            size={17}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            name="email"
            type="text"
            inputMode="email"
            autoComplete="email"
            required
            className={`${inputClassName} w-full pl-10`}
            placeholder="admin@bsvgo.com"
          />
        </span>
      </label>
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Password
        <span className="relative">
          <Lock
            size={17}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className={`${inputClassName} w-full pl-10`}
            placeholder="Admin password"
          />
        </span>
      </label>
      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className={buttonClassName("primary", "w-full")}
      >
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
