import { notFound } from "next/navigation";

import { TagForm } from "@/components/forms/TagForm";
import { updateTagAction } from "@/server/content/actions";
import { getTagForEdit } from "@/server/content/queries";

export default async function EditTagPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tag = await getTagForEdit(id);
  if (!tag) notFound();

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Edit tag</h1>
        <p className="mt-1 text-sm text-slate-500">
          Update tag metadata used by the blog frontend and recommendation query.
        </p>
      </div>
      <TagForm tag={tag} action={updateTagAction.bind(null, id)} submitLabel="Save tag" />
    </div>
  );
}
