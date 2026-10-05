import "server-only";

import type { ReviewAdapter } from "../../lib/automationReviewAdapters";

const REPOSITORY = "SupplementScout/supplementscout";

type DispatchOptions = {
  adapter: ReviewAdapter;
  reviewItemId: string;
  executionRequestId: string;
  reviewFingerprint: string;
  reviewPlanFingerprint: string;
  executionIdempotencyKey: string;
};

function githubToken() {
  return process.env.AUTOMATION_REVIEW_GITHUB_TOKEN || "";
}

function githubApiUrl() {
  return process.env.GITHUB_API_URL || "https://api.github.com";
}

function githubRepository() {
  return process.env.AUTOMATION_REVIEW_GITHUB_REPOSITORY || REPOSITORY;
}

export function reviewWorkflowDispatchConfigured() {
  return process.env.AUTOMATION_REVIEW_QUEUE_ENABLED !== "false" && githubToken().trim().length > 0;
}

export async function dispatchReviewExecution(options: DispatchOptions) {
  const token = githubToken().trim();
  if (!token) throw new Error("AUTOMATION_REVIEW_GITHUB_TOKEN_MISSING");

  const response = await fetch(`${githubApiUrl()}/repos/${githubRepository()}/actions/workflows/${encodeURIComponent(options.adapter.workflow)}/dispatches`, {
    method: "POST",
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "user-agent": "SupplementScout-Review-Queue/1.0",
      "x-github-api-version": "2022-11-28",
    },
    body: JSON.stringify({
      ref: "main",
    }),
  });
  if (response.status !== 204) {
    const detail = await response.text().catch(() => "");
    const error = new Error(`AUTOMATION_REVIEW_WORKFLOW_DISPATCH_FAILED:${response.status}`);
    (error as Error & { detail?: string }).detail = detail.slice(0, 500);
    throw error;
  }
}
