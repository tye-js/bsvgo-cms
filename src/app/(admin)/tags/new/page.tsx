import { TagForm } from "@/components/forms/TagForm";
import { createTagAction } from "@/server/content/actions";

export default function NewTagPage() {
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">New tag</h1>
        <p className="mt-1 text-sm text-slate-500">
          Create a reusable tag with English primary naming and optional Chinese naming.
        </p>
      </div>
      <TagForm action={createTagAction} submitLabel="Create tag" />
    </div>
  );
}
