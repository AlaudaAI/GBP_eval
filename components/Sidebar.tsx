"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { FEATURES } from "@/lib/features";

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="md:hidden m-3 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm print:hidden"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {open ? "Hide" : "Show"} audits
      </button>
      <aside
        className={`${open ? "block" : "hidden"} md:block w-full md:w-64 shrink-0 border-r border-slate-200 bg-white print:hidden`}
        aria-label="Audit navigation"
      >
        <nav className="p-3 space-y-1">
          <Link
            href="/"
            className={navClass(pathname === "/")}
            onClick={() => setOpen(false)}
          >
            <span className="font-mono text-xs text-slate-500 mr-2">00.</span>
            Overview
          </Link>
          {FEATURES.map((f, i) => {
            const href = `/features/${f.slug}`;
            const active = pathname === href;
            return (
              <Link
                key={f.slug}
                href={href}
                className={navClass(active)}
                onClick={() => setOpen(false)}
              >
                <span className="font-mono text-xs text-slate-500 mr-2">
                  {String(i + 1).padStart(2, "0")}.
                </span>
                {f.shortLabel}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

function navClass(active: boolean): string {
  const base = "flex items-center rounded-lg px-3 py-2 text-sm";
  if (active) return `${base} bg-brand-light text-brand-dark font-medium`;
  return `${base} text-slate-700 hover:bg-slate-100`;
}
