/**
 * Result of a GLN lookup against the RefData SOAP service.
 *
 * Mirrors the HTTP response shape of POST /api/gln-lookup so both
 * server-side infrastructure code and API route handlers can share
 * the same type without any framework dependency.
 */
export interface GlnLookupResult {
  gln:          string;
  /** "NAT" = natural person, "JUR" = juridical entity (organisation), "" = unknown */
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
