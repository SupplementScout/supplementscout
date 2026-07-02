"use client";

import type { FormEvent } from "react";

type MergeConfirmButtonProps = {
  action: string;
  canonicalId: string;
  canonicalName: string;
  candidateId: string;
  candidateName: string;
};

export function MergeConfirmButton({
  action,
  canonicalId,
  canonicalName,
  candidateId,
  candidateName,
}: MergeConfirmButtonProps) {
  const confirmationPhrase = `MERGE ${candidateId}`;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const confirmed = window.prompt(
      [
        "Confirm product merge.",
        "",
        `Canonical product ${canonicalId}: ${canonicalName}`,
        `Candidate product ${candidateId}: ${candidateName}`,
        "",
        "The candidate will become inactive, and its offers and retailer mappings will be moved to the canonical product.",
        "",
        `Type ${confirmationPhrase} to continue.`,
      ].join("\n")
    );

    if (confirmed !== confirmationPhrase) {
      window.alert("Merge cancelled. Confirmation phrase did not match.");
      event.preventDefault();
    }
  }

  return (
    <form action={action} method="post" onSubmit={handleSubmit}>
      <input type="hidden" name="canonicalId" value={canonicalId} />
      <input type="hidden" name="candidateId" value={candidateId} />
      <button
        type="submit"
        className="rounded-lg border border-emerald-700 bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:border-emerald-800 hover:bg-emerald-800"
      >
        Merge candidate into canonical
      </button>
    </form>
  );
}
