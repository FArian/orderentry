import type { GlnLookupResult } from "@/domain/entities/GlnLookupResult";
import type { RefDataItem }     from "./RefDataXmlParser";

/**
 * Maps a parsed RefData XML intermediate to the domain entity.
 *
 * NAT (natural person): DESCR1 = family name, DESCR2 = given name
 * JUR / other (organisation): DESCR1 = organisation name
 */
export function mapToGlnLookupResult(item: RefDataItem, requestedGln: string): GlnLookupResult {
  const isNat = item.ptype === "NAT";
  return {
    gln:          item.gln      || requestedGln,
    ptype:        item.ptype,
    roleType:     item.roleType,
    organization: isNat ? "" : item.descr1,
    lastName:     isNat ? item.descr1 : "",
    firstName:    isNat ? item.descr2 : "",
    street:       item.street,
    streetNo:     item.streetNo,
    zip:          item.zip,
    city:         item.city,
    canton:       item.canton,
    country:      item.country,
  };
}
