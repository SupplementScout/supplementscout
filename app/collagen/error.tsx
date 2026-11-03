"use client";

import LifecycleHubError from "../components/LifecycleHubError";

export default function Error({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return <LifecycleHubError unstable_retry={unstable_retry} />;
}
