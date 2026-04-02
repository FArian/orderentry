/**
 * Strategy pattern — patient search input interpretation.
 *
 * The user can type either a patient ID (numeric, UUID) or a patient name
 * into a single search field.  These two cases require different FHIR search
 * parameters:
 *
 *   Patient ID   → subject=Patient/<id>          (exact reference)
 *   Patient name → subject:Patient.name=<name>   (chained text search)
 *
 * The strategy pattern isolates this heuristic so it can be changed or
 * extended (e.g. to support AHV number pattern) without touching UI code.
 *
 * Design pattern: Strategy
 */

export interface PatientSearchParams {
  patientId?: string;
  patientName?: string;
}

export interface IPatientSearchStrategy {
  /** Returns true when this strategy should handle the given input. */
  matches(input: string): boolean;
  /** Builds the FHIR query params for the given input. */
  buildParams(input: string): PatientSearchParams;
}

// ── Strategies ────────────────────────────────────────────────────────────────

/**
 * Numeric-ID strategy: matches pure-digit strings that look like internal
 * patient IDs (5+ digits) or standard UUID strings.
 */
export class PatientIdStrategy implements IPatientSearchStrategy {
  private static readonly ID_PATTERN = /^\d{5,}$/;
  private static readonly UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  matches(input: string): boolean {
    const trimmed = input.trim();
    return (
      PatientIdStrategy.ID_PATTERN.test(trimmed) ||
      PatientIdStrategy.UUID_PATTERN.test(trimmed)
    );
  }

  buildParams(input: string): PatientSearchParams {
    return { patientId: input.trim() };
  }
}

/**
 * Name strategy: default fallback — any non-ID input is treated as a name.
 */
export class PatientNameStrategy implements IPatientSearchStrategy {
  matches(_input: string): boolean {
    return true; // fallback — always matches
  }

  buildParams(input: string): PatientSearchParams {
    const patientName = input.trim();
    return patientName ? { patientName } : {};
  }
}

// ── Selector ──────────────────────────────────────────────────────────────────

/**
 * Selects the appropriate strategy for a given input string.
 * Strategies are evaluated in registration order; the first match wins.
 */
export class PatientSearchStrategySelector {
  private readonly strategies: IPatientSearchStrategy[];

  constructor(strategies?: IPatientSearchStrategy[]) {
    // Specific strategies must come before the generic fallback.
    this.strategies = strategies ?? [
      new PatientIdStrategy(),
      new PatientNameStrategy(),
    ];
  }

  select(input: string): IPatientSearchStrategy {
    return (
      this.strategies.find((s) => s.matches(input)) ?? new PatientNameStrategy()
    );
  }

  /**
   * Convenience: parse the input and immediately return the FHIR params.
   */
  resolve(input: string): PatientSearchParams {
    return this.select(input).buildParams(input);
  }
}

// ── Default singleton (used by hooks) ─────────────────────────────────────────

export const patientSearchSelector = new PatientSearchStrategySelector();
