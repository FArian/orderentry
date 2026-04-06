import type { IGlnAdapter }    from "./IGlnAdapter";
import type { GlnLookupResult } from "@/domain/entities/GlnLookupResult";
import type { GlnResponseV1 }  from "../dto/GlnDto";

/**
 * Adapter: GlnLookupResult → GlnResponseV1 (flat, backward-compatible).
 *
 * Field mapping:
 *   result.ptype     → ptype
 *   result.roleType  → roleType
 *   all address fields remain at the top level
 */
export class GlnAdapterV1 implements IGlnAdapter<GlnResponseV1> {
  adapt(result: GlnLookupResult): GlnResponseV1 {
    return {
      gln:          result.gln,
      ptype:        result.ptype,
      roleType:     result.roleType,
      organization: result.organization,
      lastName:     result.lastName,
      firstName:    result.firstName,
      street:       result.street,
      streetNo:     result.streetNo,
      zip:          result.zip,
      city:         result.city,
      canton:       result.canton,
      country:      result.country,
    };
  }
}

export const glnAdapterV1 = new GlnAdapterV1();
