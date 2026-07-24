"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const MOBILE_HEADER_QUERY = "(max-width: 767px)";

const navigationItems = [
  { label: "Search supplements", href: "#search" },
  { label: "Popular categories", href: "#categories" },
  { label: "Shop by goal", href: "#goals" },
  { label: "How it works", href: "#how-it-works" },
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
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:min-h-20 sm:px-6">
        <Link
          href="/"
          className="text-lg font-bold tracking-tight text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 sm:text-xl"
        >
          SupplementScout
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

        <div className="hidden md:block">
          <Link
            href="/creatine"
            className="inline-flex min-h-11 items-center rounded-full bg-zinc-950 px-5 text-sm font-semibold text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2"
          >
            Find Deals
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

      {menuOpen && (
        <>
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => {
              setMenuOpen(false);
              menuButtonRef.current?.focus();
            }}
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
          />
          <aside
            ref={menuPanelRef}
            id="home-mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-white p-5 shadow-2xl md:hidden"
          >
            <div className="flex items-center justify-between gap-4 border-b border-zinc-200 pb-4">
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
          </aside>
        </>
      )}
    </header>
  );
}
