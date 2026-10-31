"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MY_SUPPLEMENTS_CHANGED_EVENT, readMySupplements } from "../lib/mySupplements";

export default function MySupplementsShortcut() {
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  useEffect(() => {
    const update = () => setCount(readMySupplements(window.localStorage).items.length);
    update();
    window.addEventListener("storage", update);
    window.addEventListener(MY_SUPPLEMENTS_CHANGED_EVENT, update);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener(MY_SUPPLEMENTS_CHANGED_EVENT, update);
    };
  }, []);

  if (pathname === "/my-supplements") return null;

  return (
    <Link
      href="/my-supplements"
      data-my-supplements-shortcut
      className="static z-30 mb-[max(0.75rem,env(safe-area-inset-bottom))] mr-[max(0.75rem,env(safe-area-inset-right))] mt-4 inline-flex min-h-12 max-w-[calc(100vw-1.5rem)] self-end items-center rounded-full border border-[var(--ss-border-strong)] bg-white px-4 text-sm font-bold text-[var(--ss-ink)] shadow-[0_10px_30px_rgba(16,32,27,0.14)] hover:border-[var(--ss-accent)] hover:bg-[var(--ss-surface-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--ss-accent)] focus:ring-offset-2 sm:fixed sm:bottom-4 sm:right-4 sm:m-0 sm:px-5"
      aria-label={`My Supplements, ${count} saved`}
    >
      My Supplements{count > 0 ? ` (${count})` : ""}
    </Link>
  );
}

