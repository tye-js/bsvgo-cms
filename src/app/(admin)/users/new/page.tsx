import { UserForm } from "@/components/forms/UserForm";
import { requireRole } from "@/server/auth/session";
import { createUserAction } from "@/server/content/actions";

export default async function NewUserPage() {
  await requireRole(["admin"]);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          New administrator
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Create a secured account with hashed password storage.
        </p>
      </div>
      <UserForm action={createUserAction} />
    </div>
  );
}
