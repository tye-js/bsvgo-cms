import { TagForm } from "@/components/forms/TagForm";
import { createTagAction } from "@/server/content/actions";

export default function NewTagPage() {
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">新建标签</h1>
        <p className="mt-1 text-sm text-slate-500">
          创建可复用标签，英文名称为主，中文名称可选。
        </p>
      </div>
      <TagForm action={createTagAction} submitLabel="创建标签" />
    </div>
  );
}
