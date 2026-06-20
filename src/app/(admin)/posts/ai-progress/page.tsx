import { redirect } from "next/navigation";

export default function PostAiProgressPage() {
  redirect("/ai/jobs?type=post_draft_create");
}
