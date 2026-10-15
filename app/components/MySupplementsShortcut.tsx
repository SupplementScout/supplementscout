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
      className="fixed bottom-4 right-4 z-30 inline-flex min-h-12 items-center rounded-full border border-zinc-300 bg-white px-5 text-sm font-bold text-zinc-950 shadow-lg hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2"
      aria-label={`My Supplements, ${count} saved`}
    >
      My Supplements{count > 0 ? ` (${count})` : ""}
    </Link>
  );
}

