"use client";

import { useMemo, useState } from "react";
import type {
  MergeDecisionConflicts,
  MergeDecisionValue,
  MergeOfferWithPriceHistoryCount,
  MergeReadiness,
  RetailerProductMapping,
} from "../../../lib/mergePreview";

type MergeDecisionsFormProps = {
  action: string;
  canonicalId: string;
  candidateId: string;
  decisionConflicts: MergeDecisionConflicts;
  readiness: MergeReadiness;
};

type DecisionsState = Record<string, MergeDecisionValue>;

function formatValue(value: string | number | boolean | null) {
  if (value === null || value === "") {
    return "Missing";
  }

  return String(value);
}

function offerConflictKey(
  canonicalOffer: MergeOfferWithPriceHistoryCount,
  candidateOffer: MergeOfferWithPriceHistoryCount
) {
  return `offer:${String(canonicalOffer.id)}:${String(candidateOffer.id)}`;
}

function mappingConflictKey(
  canonicalMapping: RetailerProductMapping,
  candidateMapping: RetailerProductMapping
) {
  return `mapping:${String(canonicalMapping.id)}:${String(candidateMapping.id)}`;
}

function OfferDetails({
  title,
  offer,
}: {
  title: string;
  offer: MergeOfferWithPriceHistoryCount;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-sm font-semibold text-zinc-500">{title}</p>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-zinc-500">Offer ID</dt>
          <dd className="font-medium">{String(offer.id)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Price</dt>
          <dd className="font-medium">{formatValue(offer.price)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Shipping</dt>
          <dd className="font-medium">{formatValue(offer.shipping_cost)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">In stock</dt>
          <dd className="font-medium">{formatValue(offer.in_stock)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">History</dt>
          <dd className="font-medium">{offer.priceHistoryCount}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-zinc-500">URL</dt>
          <dd className="break-all font-medium">{formatValue(offer.url)}</dd>
        </div>
      </dl>
    </div>
  );
}

function MappingDetails({
  title,
  mapping,
}: {
  title: string;
  mapping: RetailerProductMapping;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-sm font-semibold text-zinc-500">{title}</p>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-zinc-500">Mapping ID</dt>
          <dd className="font-medium">{String(mapping.id)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">External GTIN</dt>
          <dd className="font-medium">{formatValue(mapping.external_gtin)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-zinc-500">External name</dt>
          <dd className="font-medium">{formatValue(mapping.external_name)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-zinc-500">External URL</dt>
          <dd className="break-all font-medium">
            {formatValue(mapping.external_url)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function MergeDecisionsForm({
  action,
  canonicalId,
  candidateId,
  decisionConflicts,
  readiness,
}: MergeDecisionsFormProps) {
  const [decisions, setDecisions] = useState<DecisionsState>({});
  const totalDecisionCount =
    decisionConflicts.offerConflicts.length +
    decisionConflicts.retailerProductConflicts.length;
  const selectedDecisionCount = Object.keys(decisions).length;
  const isComplete = selectedDecisionCount === totalDecisionCount;
  const formStatus =
    readiness === "blocked"
      ? "Blocked"
      : isComplete
        ? "Ready to merge with decisions"
        : "Review required";
  const buttonText =
    readiness === "blocked"
      ? "Merge blocked"
      : isComplete
        ? "Backend support pending"
        : "Select all decisions";
  const decisionsJson = useMemo(
    () =>
      JSON.stringify({
        offerConflicts: decisionConflicts.offerConflicts
          .map((conflict) => ({
            canonicalOfferId: String(conflict.canonicalOffer.id),
            candidateOfferId: String(conflict.candidateOffer.id),
            decision:
              decisions[
                offerConflictKey(
                  conflict.canonicalOffer,
                  conflict.candidateOffer
                )
              ],
          }))
          .filter((item) => item.decision),
        retailerProductConflicts: decisionConflicts.retailerProductConflicts
          .map((conflict) => ({
            canonicalMappingId: String(conflict.canonicalMapping.id),
            candidateMappingId: String(conflict.candidateMapping.id),
            decision:
              decisions[
                mappingConflictKey(
                  conflict.canonicalMapping,
                  conflict.candidateMapping
                )
              ],
          }))
          .filter((item) => item.decision),
      }),
    [decisionConflicts, decisions]
  );

  function setDecision(key: string, decision: MergeDecisionValue) {
    setDecisions((current) => ({
      ...current,
      [key]: decision,
    }));
  }

  return (
    <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Conflicts requiring decision</h2>
          <p className="mt-2 text-sm text-zinc-500">
            Review each pair and choose which record should be kept.
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm">
          <p className="font-semibold">Status: {formStatus}</p>
          <p className="mt-1 text-zinc-500">
            {selectedDecisionCount} of {totalDecisionCount} decisions selected
          </p>
        </div>
      </div>

      <form action={action} method="post" className="mt-6 space-y-8">
        <input type="hidden" name="canonicalId" value={canonicalId} />
        <input type="hidden" name="candidateId" value={candidateId} />
        <input type="hidden" name="decisions" value={decisionsJson} />

        {decisionConflicts.offerConflicts.length > 0 && (
          <div>
            <h3 className="text-lg font-bold">Offer conflicts</h3>
            <div className="mt-3 space-y-4">
              {decisionConflicts.offerConflicts.map((conflict) => {
                const key = offerConflictKey(
                  conflict.canonicalOffer,
                  conflict.candidateOffer
                );

                return (
                  <div
                    key={key}
                    className="rounded-lg border border-amber-200 bg-amber-50 p-4"
                  >
                    <p className="font-semibold text-amber-950">
                      {conflict.retailer}
                    </p>
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <OfferDetails
                        title="Canonical offer"
                        offer={conflict.canonicalOffer}
                      />
                      <OfferDetails
                        title="Candidate offer"
                        offer={conflict.candidateOffer}
                      />
                    </div>
                    <fieldset className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
                      <legend className="sr-only">Offer decision</legend>
                      <label className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2">
                        <input
                          type="radio"
                          name={key}
                          value="keep_canonical"
                          checked={decisions[key] === "keep_canonical"}
                          onChange={() => setDecision(key, "keep_canonical")}
                        />
                        keep canonical
                      </label>
                      <label className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2">
                        <input
                          type="radio"
                          name={key}
                          value="keep_candidate"
                          checked={decisions[key] === "keep_candidate"}
                          onChange={() => setDecision(key, "keep_candidate")}
                        />
                        keep candidate
                      </label>
                    </fieldset>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {decisionConflicts.retailerProductConflicts.length > 0 && (
          <div>
            <h3 className="text-lg font-bold">Retailer product conflicts</h3>
            <div className="mt-3 space-y-4">
              {decisionConflicts.retailerProductConflicts.map((conflict) => {
                const key = mappingConflictKey(
                  conflict.canonicalMapping,
                  conflict.candidateMapping
                );

                return (
                  <div
                    key={key}
                    className="rounded-lg border border-amber-200 bg-amber-50 p-4"
                  >
                    <p className="font-semibold text-amber-950">
                      {conflict.retailer}
                    </p>
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <MappingDetails
                        title="Canonical mapping"
                        mapping={conflict.canonicalMapping}
                      />
                      <MappingDetails
                        title="Candidate mapping"
                        mapping={conflict.candidateMapping}
                      />
                    </div>
                    <fieldset className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
                      <legend className="sr-only">
                        Retailer product decision
                      </legend>
                      <label className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2">
                        <input
                          type="radio"
                          name={key}
                          value="keep_canonical"
                          checked={decisions[key] === "keep_canonical"}
                          onChange={() => setDecision(key, "keep_canonical")}
                        />
                        keep canonical
                      </label>
                      <label className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2">
                        <input
                          type="radio"
                          name={key}
                          value="keep_candidate"
                          checked={decisions[key] === "keep_candidate"}
                          onChange={() => setDecision(key, "keep_candidate")}
                        />
                        keep candidate
                      </label>
                    </fieldset>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="border-t border-zinc-200 pt-5">
          <button
            type="submit"
            disabled
            className="rounded-lg border border-zinc-300 bg-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-500"
          >
            {buttonText}
          </button>
        </div>
      </form>
    </section>
  );
}
