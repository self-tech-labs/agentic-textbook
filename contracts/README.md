# Ogram Learning Canvas contracts

The public contracts are transport-neutral seams between the WebMCP page, the trusted Ogram compiler/runtime, a canonical management service, and future desktop or mobile companions.

## `learning-experience.schema.json`

Defines the top-level versioned agent-authored experience document:

- exact spec, primitive-registry, and pedagogy-policy versions;
- context snapshot and learning brief bindings;
- observable objectives;
- trusted primitive nodes and bounded edges;
- learner-evidence completion policy;
- learner-reviewed adaptation policy;
- governed media references;
- pedagogy, content, personalization, and generation provenance.

Primitive-specific props are published through the live capability contract and validated by the Ogram compiler. Arbitrary HTML, CSS, JavaScript, and executable conditions are not part of this schema.

## `learning-event.schema.json`

Defines the privacy-minimized, idempotent envelope sent through an ordered outbox. Guarantees:

- append-only sequence and state revision;
- immutable experience ID/revision attribution;
- one stable idempotency key per event/command;
- explicit learner, agent, or Ogram actor;
- typed context, design, runtime, feedback, and adaptation events;
- no raw conversation, prompt, file, secret, or client content;
- no raw free-text learner response in the general ledger;
- tenant/user identity attached by the authenticated backend, never trusted from browser input.

Production delivery should enforce a unique tenant-scoped idempotency constraint, optimistic revision checks, authenticated ownership, append-only storage, and privacy-minimized journey projections.
