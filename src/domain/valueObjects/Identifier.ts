// Value object — represents a FHIR Identifier (system + value pair).

export class Identifier {
  constructor(
    public readonly system: string,
    public readonly value: string,
  ) {
    if (!(value ?? "").trim()) throw new Error("Identifier value cannot be empty");
  }

  /** Returns the FHIR token format: "system|value" */
  toToken(): string {
    return `${this.system}|${this.value}`;
  }

  equals(other: Identifier): boolean {
    return this.system === other.system && this.value === other.value;
  }

  toString(): string {
    return this.toToken();
  }
}
