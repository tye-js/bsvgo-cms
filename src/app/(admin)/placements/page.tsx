import { PostPlacementsForm } from "@/components/forms/PostPlacementsForm";
import { updatePostPlacementsAction } from "@/server/content/actions";
import { listPlacementPosts } from "@/server/content/queries";

export default async function PlacementsPage() {
  const posts = await listPlacementPosts();

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          展示位
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          集中管理首页和分类页的置顶、推广文章。文章内容和 SEO 仍在文章编辑页维护。
        </p>
      </div>

      <PostPlacementsForm
        posts={posts}
        action={updatePostPlacementsAction}
      />
    </div>
  );
}
