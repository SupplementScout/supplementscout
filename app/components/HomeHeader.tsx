"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import SupplementScoutIcon from "./SupplementScoutIcon";

const MOBILE_HEADER_QUERY = "(max-width: 767px)";

const navigationItems = [
  { label: "Supplements", href: "#categories" },
  { label: "Compare", href: "/compare" },
  { label: "Best Deals", href: "/deals" },
  { label: "Guides", href: "/how-we-compare" },
  { label: "Help Me Choose", href: "/help-me-choose" },
];

export default function HomeHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const mobileViewport = window.matchMedia(MOBILE_HEADER_QUERY);

    if (!mobileViewport.matches) return;

    const previousOverflow = document.body.style.overflow;
    let scrollLocked = true;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function restoreBodyOverflow() {
      if (!scrollLocked) return;

      document.body.style.overflow = previousOverflow;
      scrollLocked = false;
    }

    function closeAndRestoreFocus() {
      restoreBodyOverflow();
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeAndRestoreFocus();
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = Array.from(
        menuPanelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled])'
        ) || []
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);

      if (!firstElement || !lastElement) return;

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    function onViewportChange(event: MediaQueryListEvent) {
      if (event.matches) return;

      restoreBodyOverflow();
      setMenuOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    mobileViewport.addEventListener("change", onViewportChange);

    return () => {
      restoreBodyOverflow();
      window.removeEventListener("keydown", onKeyDown);
      mobileViewport.removeEventListener("change", onViewportChange);
    };
  }, [menuOpen]);

  return (
    <>
      <header className="home-header border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:min-h-20 sm:px-6">
          <Link
            href="/"
            aria-label="SupplementScout home"
            className="home-wordmark"
          >
            <SupplementScoutIcon name="search" size={24} strokeWidth={3} />
            <span>Supplement<span className="home-wordmark-accent">Scout</span></span>
          </Link>

          <nav
            aria-label="Primary navigation"
            className="hidden items-center gap-7 text-sm font-medium text-zinc-600 md:flex"
          >
            {navigationItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="home-header-utilities hidden md:flex">
            <span className="home-market" aria-label="UK market">UK</span>
            <Link
              href="/my-supplements"
              className="home-saved-link"
            >
              My Supplements
            </Link>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <a
              href="#search"
              className="inline-flex min-h-11 items-center rounded-lg border border-zinc-300 px-3 text-sm font-semibold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2"
            >
              Search
            </a>
            <button
              ref={menuButtonRef}
              type="button"
              aria-label="Open navigation menu"
              aria-expanded={menuOpen}
              aria-controls="home-mobile-menu"
              onClick={() => setMenuOpen(true)}
              className="inline-flex min-h-11 items-center rounded-lg bg-zinc-950 px-3 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2"
            >
              Menu
            </button>
          </div>
        </div>
      </header>

      {menuOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <aside
            ref={menuPanelRef}
            id="home-mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
            className="fixed inset-0 z-[100] flex h-dvh w-full flex-col overflow-x-hidden overflow-y-auto overscroll-contain bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] md:hidden"
          >
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-zinc-200 pb-4">
              <p className="text-lg font-bold">Menu</p>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  menuButtonRef.current?.focus();
                }}
                className="min-h-11 rounded-lg border border-zinc-300 px-4 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2"
              >
                Close
              </button>
            </div>

            <nav aria-label="Mobile navigation" className="mt-5 grid gap-2">
              {navigationItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    setMenuOpen(false);
                    menuButtonRef.current?.focus();
                  }}
                  className="flex min-h-12 items-center rounded-lg px-3 text-base font-semibold text-zinc-800 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-950"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </aside>,
          document.body
        )}
    </>
  );
}
