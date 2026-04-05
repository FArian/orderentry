/**
 * Versioned response shapes for GET /api/gln-lookup and GET /api/v2/gln-lookup.
 *
 * v1 — flat structure, backward-compatible (all string fields, ptype / roleType names)
 * v2 — nested structure, richer (partnerType / role, computed displayName, typed person/address)
 */

// ── v1 ─────────────────────────────────────────────────────────────────────

export interface GlnResponseV1 {
  gln:          string;
  /** "NAT" | "JUR" | "" */
  ptype:        string;
  roleType:     string;
  organization: string;
  lastName:     string;
  firstName:    string;
  street:       string;
  streetNo:     string;
  zip:          string;
  city:         string;
  canton:       string;
  country:      string;
}

// ── v2 ─────────────────────────────────────────────────────────────────────

export interface GlnPersonV2 {
  lastName:  string;
  firstName: string;
}

export interface GlnAddressV2 {
  street:   string;
  streetNo: string;
  zip:      string;
  city:     string;
  canton:   string;
  country:  string;
}

export interface GlnResponseV2 {
  gln:          string;
  /** Renamed from ptype. "NAT" | "JUR" | "" */
  partnerType:  string;
  /** Renamed from roleType. */
  role:         string;
  /** Computed: "Müller Hans" (NAT) or "Hirslanden AG" (JUR) */
  displayName:  string;
  /** Populated for NAT, null for JUR */
  person:       GlnPersonV2 | null;
  /** Populated for JUR, null for NAT */
  organization: string | null;
  address:      GlnAddressV2;
}
