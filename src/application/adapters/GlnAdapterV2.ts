import type { IGlnAdapter }    from "./IGlnAdapter";
import type { GlnLookupResult } from "@/domain/entities/GlnLookupResult";
import type { GlnResponseV2 }  from "../dto/GlnDto";

/**
 * Adapter: GlnLookupResult → GlnResponseV2 (nested, richer structure).
 *
 * Breaking changes from v1 (reason for v2):
 *   ptype     → partnerType
 *   roleType  → role
 *   flat fields → nested person{} / address{} objects
 *   + computed displayName field
 *   + organization is null (not "") for NAT partners
 */
export class GlnAdapterV2 implements IGlnAdapter<GlnResponseV2> {
  adapt(result: GlnLookupResult): GlnResponseV2 {
    const isNat = result.ptype === "NAT";

    const displayName = isNat
      ? [result.lastName, result.firstName].filter(Boolean).join(" ")
      : result.organization;

    return {
      gln:          result.gln,
      partnerType:  result.ptype,
      role:         result.roleType,
      displayName:  displayName || result.gln,
      person:       isNat
        ? { lastName: result.lastName, firstName: result.firstName }
        : null,
      organization: isNat ? null : result.organization,
      address: {
        street:   result.street,
        streetNo: result.streetNo,
        zip:      result.zip,
        city:     result.city,
        canton:   result.canton,
        country:  result.country,
      },
    };
  }
}

export const glnAdapterV2 = new GlnAdapterV2();
