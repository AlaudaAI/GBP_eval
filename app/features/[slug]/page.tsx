"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { FEATURES, findFeature } from "@/lib/features";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { WorkspaceFallback } from "@/components/WorkspaceFallback";
import { AuditForm } from "@/components/AuditForm";

export default function FeaturePage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const feature = useMemo(() => (slug ? findFeature(slug) : undefined), [slug]);
  const { activeProject, loading } = useWorkspace();

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (!feature) return <p className="text-sm text-red-700">Unknown audit: {slug}</p>;
  if (!activeProject) return <WorkspaceFallback />;

  const index = FEATURES.findIndex((f) => f.slug === feature.slug);
  const prev = FEATURES[index - 1];
  const next = FEATURES[index + 1];

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-mono text-slate-500">
          Audit {index + 1} of {FEATURES.length}
        </p>
        <h1 className="text-2xl font-semibold text-slate-900 mt-1">{feature.title}</h1>
        <p className="text-sm text-slate-600 mt-1">{feature.summary}</p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-medium text-slate-900 mb-2">Why it matters</h2>
        <p className="text-sm text-slate-700">{feature.whyItMatters}</p>
      </section>

      <AuditForm feature={feature} project={activeProject} />

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-medium text-slate-900 mb-2">How to implement</h2>
        <ul className="list-disc list-inside space-y-1 text-sm text-slate-700">
          {feature.howToImplement.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      </section>

      <nav className="flex items-center justify-between text-sm">
        {prev ? (
          <Link href={`/features/${prev.slug}`} className="text-brand hover:underline">
            ← {prev.shortLabel}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={`/features/${next.slug}`} className="text-brand hover:underline">
            {next.shortLabel} →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
