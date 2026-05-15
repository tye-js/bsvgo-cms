import { notFound } from "next/navigation";

import { PostForm } from "@/components/forms/PostForm";
import { updatePostAction } from "@/server/content/actions";
import {
  getPostEditorOptions,
  getPostForEdit,
  getRelatedPostsForPost
} from "@/server/content/queries";

export default async function EditPostPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [post, options, related] = await Promise.all([
    getPostForEdit(id),
    getPostEditorOptions(),
    getRelatedPostsForPost(id)
  ]);

  if (!post) notFound();

  const update = updatePostAction.bind(null, id);

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            Edit post
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Update content, publishing state, SEO fields, and automatic recommendation inputs.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          <p className="font-medium text-slate-950">Automatic recommendations</p>
          <p className="mt-1">
            {related.length
              ? related.map((item) => item.title).join(", ")
              : "No related published posts yet."}
          </p>
        </div>
      </div>
      <PostForm
        action={update}
        categories={options.categories}
        tags={options.tags}
        post={post}
        submitLabel="Save changes"
      />
    </div>
  );
}
