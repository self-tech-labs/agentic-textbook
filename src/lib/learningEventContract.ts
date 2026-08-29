import validate from "../generated/validateLearningEvent";

interface ValidationError {
  instancePath?: string;
  message?: string;
}

interface ContractValidator {
  (value: unknown): boolean;
  errors?: ValidationError[] | null;
}

const contractValidator = validate as ContractValidator;

export function isValidLearningEventEnvelope(value: unknown): boolean {
  return contractValidator(value);
}

export function assertValidLearningEventEnvelope(value: unknown): void {
  if (contractValidator(value)) return;

  const details = (contractValidator.errors ?? [])
    .slice(0, 3)
    .map((error) => `${error.instancePath || "/"} ${error.message ?? "is invalid"}`)
    .join("; ");
  throw new Error(
    `Learning event violates the public envelope contract${
      details ? `: ${details}` : "."
    }`,
  );
}
