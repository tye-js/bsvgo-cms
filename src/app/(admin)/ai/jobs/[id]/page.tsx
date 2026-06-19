import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock3, Loader2 } from "lucide-react";

import { buttonClassName } from "@/components/admin/Button";
import { CopyButton } from "@/components/admin/CopyButton";
import { AiJobRetryButton } from "@/components/forms/AiJobRetryButton";
import {
  aiJobStatusClassName,
  aiJobStatusLabel,
  aiJobTypeLabel,
  stringifyJson
} from "@/lib/ai-jobs";
import { formatDate } from "@/lib/utils";
import { getAiJobDetailForUser } from "@/server/ai/jobs";
import { requireContentEditor } from "@/server/auth/session";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function JsonPanel({
  title,
  value
}: {
  title: string;
  value: Record<string, unknown> | null;
}) {
  const text = stringifyJson(value);

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <h2 className="font-semibold text-slate-950">{title}</h2>
        <CopyButton
          value={text || "{}"}
          label="复制 JSON"
          copiedLabel="已复制"
          className="min-h-8 px-2"
        />
      </div>
      <pre className="max-h-[520px] overflow-auto bg-slate-950 p-5 text-xs leading-5 text-slate-100">
        {text || "{}"}
      </pre>
    </section>
  );
}

export default async function AiJobDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!uuidPattern.test(id)) notFound();

  const user = await requireContentEditor();
  const job = await getAiJobDetailForUser(id, user);
  if (!job) notFound();

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <Link
            href="/ai/jobs"
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft size={14} />
            返回 AI 任务中心
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
            {aiJobTypeLabel(job.type)}
          </h1>
          <p className="mt-1 break-all text-sm text-slate-500">{job.id}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {job.status === "failed" ? <AiJobRetryButton jobId={job.id} /> : null}
          <Link href="/ai/jobs" className={buttonClassName("secondary")}>
            返回列表
          </Link>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">状态</p>
          <span
            className={`mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${aiJobStatusClassName(job.status)}`}
          >
            {job.status === "running" ? (
              <Loader2 size={13} className="animate-spin" />
            ) : job.status === "queued" ? (
              <Clock3 size={13} />
            ) : null}
            {aiJobStatusLabel(job.status)}
          </span>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">执行次数</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">
            {job.attempts}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">创建时间</p>
          <p className="mt-2 text-sm font-medium text-slate-950">
            {formatDate(job.createdAt)}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">完成时间</p>
          <p className="mt-2 text-sm font-medium text-slate-950">
            {formatDate(job.finishedAt)}
          </p>
        </div>
      </section>

      {job.error ? (
        <section className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <h2 className="font-semibold">错误信息</h2>
          <p className="mt-2 leading-6">{job.error}</p>
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <JsonPanel title="输入" value={job.input} />
        <JsonPanel title="输出" value={job.output} />
      </div>
    </div>
  );
}
