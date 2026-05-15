import { Database, ShieldCheck, Upload } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Operational configuration notes for the current CMS deployment.
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <Database className="mb-4 text-slate-500" size={22} />
          <h2 className="font-semibold text-slate-950">Database</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Content is stored in PostgreSQL through Drizzle schema and migrations.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <ShieldCheck className="mb-4 text-slate-500" size={22} />
          <h2 className="font-semibold text-slate-950">Authentication</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Sessions are database-backed and password hashes use Argon2id.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <Upload className="mb-4 text-slate-500" size={22} />
          <h2 className="font-semibold text-slate-950">Media</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Version 1 stores image URLs only. Upload can be added later with local storage or object storage policies.
          </p>
        </div>
      </section>
    </div>
  );
}
