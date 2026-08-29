import { useEffect, useId, useState, type FormEvent } from "react";
import type { LearningCapsule } from "../domain/types";

type PracticeContract = LearningCapsule["practiceContract"];
type ContractField = keyof PracticeContract;

export interface PracticeContractSubmission {
  contract: PracticeContract;
  reminderEnabled: boolean;
}

interface PracticeContractEditorProps {
  capsuleId: string;
  contract: PracticeContract;
  onSubmit: (
    submission: PracticeContractSubmission,
  ) => void | Promise<void>;
  defaultReminderEnabled?: boolean;
  showReminder?: boolean;
  submitLabel?: string;
}

const fieldLimits: Record<ContractField, number> = {
  cue: 220,
  response: 220,
  proof: 220,
};

const minimumFieldLength = 8;

const fieldCopy: Record<
  ContractField,
  {
    index: string;
    label: string;
    note: string;
    rows: number;
  }
> = {
  cue: {
    index: "01",
    label: "When you notice…",
    note: "Name the moment that should trigger this practice.",
    rows: 2,
  },
  response: {
    index: "02",
    label: "Do this…",
    note: "Write the smallest useful response you can take immediately.",
    rows: 2,
  },
  proof: {
    index: "03",
    label: "You’ll know it worked when…",
    note: "Choose an observable sign, not a feeling or intention.",
    rows: 2,
  },
};

const contractFields = Object.keys(fieldCopy) as ContractField[];

export function PracticeContractEditor({
  capsuleId,
  contract,
  onSubmit,
  defaultReminderEnabled = false,
  showReminder = true,
  submitLabel = "Save this practice",
}: PracticeContractEditorProps) {
  const formId = useId();
  const [draft, setDraft] = useState<PracticeContract>(contract);
  const [reminderEnabled, setReminderEnabled] = useState(
    defaultReminderEnabled,
  );
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setDraft(contract);
    setReminderEnabled(defaultReminderEnabled);
    setSubmitted(false);
    setSubmitting(false);
  }, [
    capsuleId,
    contract.cue,
    contract.response,
    contract.proof,
    defaultReminderEnabled,
  ]);

  const incompleteFields = contractFields.filter(
    (field) => draft[field].trim().length < minimumFieldLength,
  );
  const validationId = `${formId}-validation`;
  const headingId = `${formId}-heading`;
  const descriptionId = `${formId}-description`;

  const updateField = (field: ContractField, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);

    if (incompleteFields.length > 0 || submitting) return;

    const normalizedContract: PracticeContract = {
      cue: draft.cue.trim(),
      response: draft.response.trim(),
      proof: draft.proof.trim(),
    };

    setSubmitting(true);
    try {
      await onSubmit({
        contract: normalizedContract,
        reminderEnabled: showReminder && reminderEnabled,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      className="practice-contract-editor learning-ledger-form"
      data-capsule-id={capsuleId}
      aria-labelledby={headingId}
      aria-describedby={descriptionId}
      onSubmit={submit}
    >
      <header className="contract-editor-header ledger-section-header">
        <p className="eyebrow">Your practice contract</p>
        <h2 id={headingId}>Make the rule yours before Ogram remembers it.</h2>
        <p id={descriptionId} className="contract-editor-description">
          Inspect each line and change anything that would make it useful in real
          work. Completion records the proof in your journey; the browser cache
          keeps all three lines for refresh recovery.
        </p>
      </header>

      <fieldset className="contract-fields">
        <legend className="visually-hidden">
          Cue, response, and proof for this practice
        </legend>

        <div className="contract-field-list ledger-lines">
          {contractFields.map((field) => {
            const copy = fieldCopy[field];
            const inputId = `${formId}-${field}`;
            const noteId = `${inputId}-note`;
            const countId = `${inputId}-count`;
            const invalid =
              submitted && draft[field].trim().length < minimumFieldLength;

            return (
              <div
                className={`contract-field contract-field--${field} ledger-line`}
                data-contract-field={field}
                key={field}
              >
                <span className="contract-field-index" aria-hidden="true">
                  {copy.index}
                </span>

                <label className="contract-field-label" htmlFor={inputId}>
                  {copy.label}
                </label>

                <div className="contract-field-entry">
                  <textarea
                    id={inputId}
                    className="contract-field-input"
                    name={field}
                    rows={copy.rows}
                    value={draft[field]}
                    maxLength={fieldLimits[field]}
                    minLength={minimumFieldLength}
                    required
                    aria-invalid={invalid || undefined}
                    aria-describedby={`${noteId} ${countId}${invalid ? ` ${validationId}` : ""}`}
                    onChange={(event) => updateField(field, event.target.value)}
                  />

                  <div className="contract-field-meta">
                    <small id={noteId} className="contract-field-note">
                      {copy.note}
                    </small>
                    <output
                      id={countId}
                      className="contract-field-count"
                      htmlFor={inputId}
                      aria-label={`${draft[field].length} of ${fieldLimits[field]} characters used`}
                    >
                      {draft[field].length}/{fieldLimits[field]}
                    </output>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </fieldset>

      {submitted && incompleteFields.length > 0 ? (
        <p
          className="contract-validation-message"
          id={validationId}
          role="alert"
        >
          Give each line at least {minimumFieldLength} characters before saving
          this practice.
        </p>
      ) : null}

      {showReminder ? (
        <label className="contract-reminder ledger-consent-line">
          <input
            type="checkbox"
            checked={reminderEnabled}
            onChange={(event) => setReminderEnabled(event.target.checked)}
          />
          <span className="contract-reminder-copy">
            <strong>Bring this rule back at the next matching moment</strong>
            <small>
              If checked, the reminder event sends this cue, response, and proof
              to Ogram—not your task messages or files.
            </small>
          </span>
        </label>
      ) : null}

      <footer className="contract-editor-actions ledger-form-actions">
        <p className="contract-editor-ownership">
          Generated for you. Confirmed by you.
        </p>
        <button
          className="primary-button contract-submit-button"
          type="submit"
          disabled={submitting}
        >
          {submitting ? "Saving…" : submitLabel}
          <span aria-hidden="true">→</span>
        </button>
      </footer>
    </form>
  );
}
