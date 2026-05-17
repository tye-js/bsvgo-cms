"use client";

import { useActionState } from "react";

import { buttonClassName } from "@/components/admin/Button";
import { Field, inputClassName } from "@/components/admin/Field";
import { SubmitButton } from "@/components/forms/SubmitButton";

type ActionState = {
  error?: string;
};

export function UserForm({
  action
}: {
  action: (
    previousState: ActionState,
    formData: FormData
  ) => Promise<ActionState>;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="max-w-2xl rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="font-semibold text-slate-950">新建管理员</h2>
        <p className="mt-1 text-sm text-slate-500">
          编辑可以管理内容，管理员还可以管理后台账号。
        </p>
      </div>
      {state.error ? (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      <div className="grid gap-4">
        <Field label="姓名">
          <input name="name" required className={inputClassName} />
        </Field>
        <Field label="邮箱">
          <input name="email" type="email" required className={inputClassName} />
        </Field>
        <Field label="密码">
          <input name="password" type="password" required className={inputClassName} />
        </Field>
        <Field label="角色">
          <select name="role" defaultValue="editor" className={inputClassName}>
            <option value="editor">编辑</option>
            <option value="admin">管理员</option>
          </select>
        </Field>
        <div className="flex gap-2">
          <SubmitButton>创建用户</SubmitButton>
          <a href="/users" className={buttonClassName("secondary")}>
            取消
          </a>
        </div>
      </div>
    </form>
  );
}
