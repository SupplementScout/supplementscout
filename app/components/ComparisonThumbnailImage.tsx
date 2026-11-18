"use client";

import { useState } from "react";

export default function ComparisonThumbnailImage({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        aria-label={`Image unavailable for ${name}`}
        className="flex h-full w-full items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white px-2 text-center text-xs font-semibold text-zinc-500"
      >
        Image unavailable
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- Keep the existing original source; the fixed thumbnail frame reserves its layout space.
    <img
      src={src}
      alt={`${name} product image`}
      width={128}
      height={128}
      loading="lazy"
      decoding="async"
      className="h-full w-full object-contain"
      onError={() => setFailed(true)}
      ref={(image) => {
        // A cached failure can finish before hydration attaches onError.
        if (image?.complete && image.naturalWidth === 0) setFailed(true);
      }}
    />
  );
}
