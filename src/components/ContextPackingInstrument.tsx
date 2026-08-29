import { useMemo, useState } from "react";
import type {
  ContextPackCard,
  ContextPackCardId,
  ContextPackPlacement,
  ContextPackReview,
  ContextPackZone,
  ContextPackingInstrument as ContextPackingInstrumentRecord,
  PracticeCollaboration,
} from "../domain/types";

interface ContextPackingInstrumentProps {
  capsuleId: string;
  instrument: ContextPackingInstrumentRecord;
  collaboration: PracticeCollaboration;
  nativeWebMcpReady: boolean;
  onShare: (placements: ContextPackPlacement[]) => void | Promise<void>;
  onWithdraw: () => void;
  onResolveReview: (
    reviewId: string,
    resolution: "accepted" | "dismissed",
  ) => void;
  onContinue: () => void;
}

type DraftPlacements = Partial<Record<ContextPackCardId, ContextPackZone>>;

function initialDraft(
  instrument: ContextPackingInstrumentRecord,
  collaboration: PracticeCollaboration,
): DraftPlacements {
  const latest = collaboration.snapshots.at(-1);
  const draft = Object.fromEntries(
    (latest?.placements ?? []).map((placement) => [
      placement.cardId,
      placement.zone,
    ]),
  ) as DraftPlacements;
  const acceptedReview = collaboration.reviews.at(-1);
  if (
    latest &&
    acceptedReview?.attemptRevision === latest.attemptRevision &&
    acceptedReview.move === "reconsider_card" &&
    acceptedReview.resolution === "accepted" &&
    acceptedReview.cardId
  ) {
    const card = instrument.cards.find(
      (candidate) => candidate.id === acceptedReview.cardId,
    );
    if (card) draft[card.id] = card.expectedZone;
  }
  return draft;
}

function PackCard({
  card,
  zone,
  locked,
  highlighted,
  onPlace,
}: {
  card: ContextPackCard;
  zone: ContextPackZone | null;
  locked: boolean;
  highlighted: boolean;
  onPlace: (zone: ContextPackZone) => void;
}) {
  return (
    <article
      className={`pack-card ${zone ? `is-${zone}` : "is-source"} ${
        highlighted ? "has-coaching-marker" : ""
      }`}
      data-card-id={card.id}
    >
      {highlighted ? (
        <span className="pack-card__pin">Codex note</span>
      ) : null}
      <div className="pack-card__copy">
        <strong>{card.label}</strong>
        <p>{card.description}</p>
      </div>
      <div className="pack-card__controls" aria-label={`Place ${card.label}`}>
        <button
          type="button"
          className={zone === "carry" ? "is-active" : ""}
          data-zone="carry"
          aria-label={`Carry ${card.label}`}
          aria-pressed={zone === "carry"}
          disabled={locked}
          onClick={() => onPlace("carry")}
        >
          Carry
        </button>
        <button
          type="button"
          className={zone === "leave" ? "is-active" : ""}
          data-zone="leave"
          aria-label={`Leave ${card.label}`}
          aria-pressed={zone === "leave"}
          disabled={locked}
          onClick={() => onPlace("leave")}
        >
          Leave
        </button>
      </div>
    </article>
  );
}

function RevisionComparison({
  instrument,
  collaboration,
}: {
  instrument: ContextPackingInstrumentRecord;
  collaboration: PracticeCollaboration;
}) {
  const latest = collaboration.snapshots.at(-1);
  const previous = collaboration.snapshots.at(-2);
  if (!latest || !previous) return null;
  const previousZones = new Map(
    previous.placements.map((placement) => [placement.cardId, placement.zone]),
  );
  const changed = latest.placements.filter(
    (placement) => previousZones.get(placement.cardId) !== placement.zone,
  );
  return (
    <section className="revision-comparison" aria-labelledby="revision-comparison-title">
      <p className="eyebrow">Learner revision</p>
      <h3 id="revision-comparison-title">
        r{previous.attemptRevision} → r{latest.attemptRevision}
      </h3>
      {changed.length > 0 ? (
        <ul>
          {changed.map((placement) => {
            const card = instrument.cards.find(
              (candidate) => candidate.id === placement.cardId,
            )!;
            return (
              <li key={placement.cardId}>
                <strong>{card.label}</strong>
                <span>
                  {previousZones.get(placement.cardId)} → {placement.zone}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p>No card changed between the two shared revisions.</p>
      )}
      <small>Codex moved 0 cards.</small>
    </section>
  );
}

function CoachingNote({
  review,
  card,
  onAccept,
  onDismiss,
}: {
  review: ContextPackReview;
  card: ContextPackCard | null;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  return (
    <section className="codex-marginalia" aria-live="polite">
      <p className="codex-marginalia__stamp">
        Codex · note on r{review.attemptRevision}
      </p>
      <p>{review.message}</p>
      {card ? <strong>Target · {card.label}</strong> : null}
      <div className="coaching-tool-receipt" aria-label="WebMCP coaching receipt">
        <code>ogram_record_coaching_move</code>
        <span>
          r{review.attemptRevision} · consent consumed · Codex moved 0 cards
        </span>
      </div>
      {review.resolution === "pending" ? (
        <div className="codex-marginalia__actions">
          <button type="button" onClick={onAccept}>
            Use this note
          </button>
          <button type="button" onClick={onDismiss}>
            Keep my placement
          </button>
        </div>
      ) : (
        <small>
          Learner {review.resolution === "accepted" ? "used" : "considered"} this
          note. The next edit remains private until it is shared again.
        </small>
      )}
    </section>
  );
}

export function ContextPackingInstrument({
  capsuleId,
  instrument,
  collaboration,
  nativeWebMcpReady,
  onShare,
  onWithdraw,
  onResolveReview,
  onContinue,
}: ContextPackingInstrumentProps) {
  const [draft, setDraft] = useState<DraftPlacements>(() =>
    initialDraft(instrument, collaboration),
  );
  const [consentChecked, setConsentChecked] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [interactionError, setInteractionError] = useState<string | null>(null);
  const latestReview = collaboration.reviews.at(-1) ?? null;
  const highlightedCardId =
    latestReview?.move === "reconsider_card" ? latestReview.cardId : null;
  const highlightedCard =
    instrument.cards.find((card) => card.id === highlightedCardId) ?? null;
  const editable =
    collaboration.phase === "drafting" ||
    (collaboration.phase === "revision_requested" &&
      latestReview?.resolution !== "pending");
  const placedCount = Object.keys(draft).length;
  const allPlaced = placedCount === instrument.cards.length;

  const zones = useMemo(
    () => ({
      source: instrument.cards.filter((card) => draft[card.id] === undefined),
      carry: instrument.cards.filter((card) => draft[card.id] === "carry"),
      leave: instrument.cards.filter((card) => draft[card.id] === "leave"),
    }),
    [draft, instrument.cards],
  );

  const place = (cardId: ContextPackCardId, zone: ContextPackZone) => {
    if (!editable) return;
    setDraft((current) => ({ ...current, [cardId]: zone }));
    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLButtonElement>(
          `[data-card-id="${cardId}"] button[data-zone="${zone}"]`,
        )
        ?.focus({ preventScroll: true });
    });
  };

  const share = async () => {
    if (!allPlaced || !consentChecked || sharing) return;
    setInteractionError(null);
    setSharing(true);
    try {
      await onShare(
        instrument.cards.map((card) => ({
          cardId: card.id,
          zone: draft[card.id]!,
        })),
      );
      setConsentChecked(false);
    } catch (error) {
      setInteractionError(
        error instanceof Error
          ? error.message.slice(0, 220)
          : "This revision could not be shared. Review the board and try again.",
      );
    } finally {
      setSharing(false);
    }
  };

  const resolveReview = (resolution: "accepted" | "dismissed") => {
    if (!latestReview || latestReview.move !== "reconsider_card") return;
    setInteractionError(null);
    try {
      onResolveReview(latestReview.id, resolution);
      if (resolution === "accepted" && latestReview.cardId) {
        const card = instrument.cards.find(
          (candidate) => candidate.id === latestReview.cardId,
        );
        if (card) {
          setDraft((current) => ({
            ...current,
            [card.id]: card.expectedZone,
          }));
        }
      }
    } catch (error) {
      setInteractionError(
        error instanceof Error
          ? error.message.slice(0, 220)
          : "That coaching response is stale. Inspect the current revision and try again.",
      );
    }
  };

  const withdraw = () => {
    setInteractionError(null);
    try {
      onWithdraw();
    } catch (error) {
      setInteractionError(
        error instanceof Error
          ? error.message.slice(0, 220)
          : "Access could not be withdrawn. Refresh the current revision and try again.",
      );
    }
  };

  return (
    <section
      className="context-packing-instrument"
      data-capsule-id={capsuleId}
      aria-labelledby="context-packing-title"
    >
      <header className="packing-header">
        <div>
          <p className="eyebrow">Shared learning instrument</p>
          <h2 id="context-packing-title">{instrument.title}</h2>
          <p>{instrument.prompt}</p>
        </div>
        <div className="packing-privacy-ribbon">
          <strong>Private by default</strong>
          <span>
            Codex sees no movement until you share one frozen revision. Raw task
            content never crosses this tool boundary.
          </span>
        </div>
      </header>

      <div className="packing-workbench">
        <div className="packing-board" aria-label="Context packing board">
          {(
            [
              ["source", "Unplaced", "Decide where each structural card belongs."],
              ["carry", "Carry into fork", "Only what the next task needs to act."],
              ["leave", "Leave in source", "Exploration and private material stay behind."],
            ] as const
          ).map(([zone, title, description]) => (
            <section className={`packing-zone is-${zone}`} key={zone}>
              <header>
                <span>{String(zones[zone].length).padStart(2, "0")}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              </header>
              <div className="packing-zone__cards">
                {zones[zone].length > 0 ? (
                  zones[zone].map((card) => (
                    <PackCard
                      card={card}
                      zone={zone === "source" ? null : zone}
                      locked={!editable}
                      highlighted={card.id === highlightedCardId}
                      onPlace={(nextZone) => place(card.id, nextZone)}
                      key={card.id}
                    />
                  ))
                ) : (
                  <p className="packing-zone__empty">No cards here.</p>
                )}
              </div>
            </section>
          ))}
        </div>

        <aside className="collaboration-margin" aria-labelledby="collaboration-title">
          <header>
            <p className="eyebrow">Collaboration margin</p>
            <h2 id="collaboration-title">Learner ↔ Codex</h2>
          </header>

          {interactionError ? (
            <p className="instrument-interaction-error" role="alert">
              {interactionError}
            </p>
          ) : null}

          {collaboration.phase === "drafting" ||
          collaboration.phase === "revision_requested" ? (
            <div className="share-attempt-panel">
              <p>
                {allPlaced
                  ? "Your private draft is complete. Freeze it when you want one Codex review."
                  : `${placedCount} of ${instrument.cards.length} cards placed. Nothing is shared yet.`}
              </p>
              {latestReview ? (
                <CoachingNote
                  review={latestReview}
                  card={highlightedCard}
                  onAccept={() => resolveReview("accepted")}
                  onDismiss={() => resolveReview("dismissed")}
                />
              ) : null}
              {latestReview?.resolution !== "pending" ? (
                <>
                  <label className="inspection-consent">
                    <input
                      type="checkbox"
                      checked={consentChecked}
                      disabled={!allPlaced || collaboration.attemptRevision >= 12}
                      onChange={(event) => setConsentChecked(event.target.checked)}
                    />
                    <span>
                      Let Codex inspect this frozen revision’s 8 structural cards,
                      zones, and three rubric indicators for one review cycle.
                    </span>
                  </label>
                  <button
                    className="share-attempt-button"
                    type="button"
                    disabled={!allPlaced || !consentChecked || sharing}
                    onClick={() => void share()}
                  >
                    {sharing
                      ? "Freezing revision…"
                      : `Share as r${collaboration.attemptRevision + 1}`}
                  </button>
                </>
              ) : null}
            </div>
          ) : null}

          {collaboration.phase === "awaiting_review" ? (
            <div className="awaiting-review" aria-live="polite">
              <span className="status-light is-syncing" aria-hidden="true" />
              <h3>r{collaboration.attemptRevision} is open to Codex</h3>
              <p>
                Available for review: 8 structural card IDs, page-owned labels and
                descriptions, 2 zones, 3 rubric indicators, and the prior bounded
                move. Excluded: prompts, responses, files, paths, people, and your
                private edits.
              </p>
              {nativeWebMcpReady ? (
                <p className="agent-instruction">
                  In ChatGPT Work, ask: “Inspect my shared Ogram attempt and leave
                  one coaching move.”
                </p>
              ) : (
                <p className="agent-instruction">
                  Open this page in ChatGPT Work with site tools enabled to request
                  the coaching turn. The page will not impersonate Codex locally.
                </p>
              )}
              <button className="withdraw-access-button" type="button" onClick={withdraw}>
                Withdraw access and edit
              </button>
            </div>
          ) : null}

          {collaboration.phase === "ready" && latestReview ? (
            <div className="ready-to-carry" aria-live="polite">
              <p className="ready-stamp">Codex · verified r{latestReview.attemptRevision}</p>
              <h3>Ready to fork</h3>
              <p>{latestReview.message}</p>
              <div className="coaching-tool-receipt" aria-label="WebMCP readiness receipt">
                <code>ogram_record_coaching_move</code>
                <span>
                  r{latestReview.attemptRevision} · consent consumed · Codex moved 0 cards
                </span>
              </div>
              <button className="primary-button" type="button" onClick={onContinue}>
                Carry the habit forward <span aria-hidden="true">→</span>
              </button>
            </div>
          ) : null}

          <ol className="collaboration-trace" aria-label="Collaboration turns">
            {collaboration.snapshots.map((snapshot) => {
              const review = collaboration.reviews.find(
                (candidate) =>
                  candidate.attemptRevision === snapshot.attemptRevision,
              );
              return (
                <li key={snapshot.attemptRevision}>
                  <span>Learner · r{snapshot.attemptRevision}</span>
                  <strong>
                    {review
                      ? review.move === "confirm_ready"
                        ? "Codex confirmed ready"
                        : "Codex left one note"
                      : collaboration.consent === "granted"
                        ? "Awaiting Codex"
                        : "Access withdrawn"}
                  </strong>
                </li>
              );
            })}
          </ol>

          <RevisionComparison
            instrument={instrument}
            collaboration={collaboration}
          />
        </aside>
      </div>
    </section>
  );
}
