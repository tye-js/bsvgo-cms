import { notFound } from "next/navigation";

import { CategoryForm } from "@/components/forms/CategoryForm";
import { updateCategoryAction } from "@/server/content/actions";
import { getCategoryForEdit } from "@/server/content/queries";

export default async function EditCategoryPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const category = await getCategoryForEdit(id);
  if (!category) notFound();

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          编辑分类
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          更新分类文案，不改变固定分类模型。
        </p>
      </div>
      <CategoryForm category={category} action={updateCategoryAction.bind(null, id)} />
    </div>
  );
}
