import type { Analysis } from "@/domain/entities/Analysis";

// Minimal FHIR Observation type scoped to this mapper.
interface FhirCoding { code?: string; display?: string }
interface FhirObservation {
  resourceType: "Observation";
  id?: string;
  code?: { text?: string; coding?: FhirCoding[] };
  category?: Array<{ text?: string; coding?: FhirCoding[] }>;
  valueQuantity?: { unit?: string };
  dataAbsentReason?: { text?: string };
}

/**
 * Maps a FHIR Observation resource to the domain Analysis entity.
 */
export class ObservationMapper {
  static toDomain(fhir: FhirObservation): Analysis {
    const unit = fhir.valueQuantity?.unit;
    return {
      id: fhir.id ?? "",
      code: fhir.code?.coding?.[0]?.code ?? "",
      display:
        fhir.code?.text ?? fhir.code?.coding?.[0]?.display ?? "",
      category:
        fhir.category?.[0]?.text ??
        fhir.category?.[0]?.coding?.[0]?.display ??
        "",
      ...(unit !== undefined && { unit }),
    };
  }
}
