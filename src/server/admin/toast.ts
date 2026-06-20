import "server-only";

import { redirect } from "next/navigation";

export function redirectWithToast({
  path,
  message,
  type = "success"
}: {
  path: string;
  message: string;
  type?: "success" | "error";
}): never {
  const [pathname, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set("toast", message);
  params.set("toastType", type);
  redirect(`${pathname}?${params.toString()}`);
}
