import { PostForm } from "@/components/forms/PostForm";
import { createPostAction } from "@/server/content/actions";
import { getPostEditorOptions } from "@/server/content/queries";

export default async function NewPostPage() {
  const options = await getPostEditorOptions();

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">New post</h1>
        <p className="mt-1 text-sm text-slate-500">
          Create one article record with English as primary content and optional Chinese translation.
        </p>
      </div>
      <PostForm
        action={createPostAction}
        categories={options.categories}
        tags={options.tags}
        submitLabel="Create post"
      />
    </div>
  );
}
