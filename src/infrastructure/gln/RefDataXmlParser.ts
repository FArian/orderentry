import { XMLParser } from "fast-xml-parser";

/**
 * Parsed intermediate from a RefData GLN_DETAIL SOAP response.
 * All fields are strings; empty string = absent in XML.
 */
export interface RefDataItem {
  okError:  string;   // RESULT.OK_ERROR
  ptype:    string;   // ITEM.PTYPE
  gln:      string;   // ITEM.GLN
  descr1:   string;   // ITEM.DESCR1
  descr2:   string;   // ITEM.DESCR2
  roleType: string;   // ITEM.ROLE.TYPE
  street:   string;   // ITEM.ROLE.STREET
  streetNo: string;   // ITEM.ROLE.STRNO
  zip:      string;   // ITEM.ROLE.ZIP
  city:     string;   // ITEM.ROLE.CITY
  canton:   string;   // ITEM.ROLE.CTN
  country:  string;   // ITEM.ROLE.CNTRY
}

const EMPTY_ITEM: RefDataItem = {
  okError: "", ptype: "", gln: "", descr1: "", descr2: "",
  roleType: "", street: "", streetNo: "", zip: "", city: "", canton: "", country: "",
};

// XXE-safe parser: no external entity resolution, no DTD processing.
const parser = new XMLParser({
  ignoreAttributes:          false,
  parseAttributeValue:       false,
  parseTagValue:             true,
  trimValues:                true,
  allowBooleanAttributes:    false,
  processEntities:           false,   // never resolve &xxe; entities
  htmlEntities:              false,
});

function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

/**
 * Parse a RefData GLN_DETAIL SOAP XML response into a flat intermediate.
 * Returns EMPTY_ITEM (okError === "") on any parse error.
 */
export function parseRefDataXml(xml: string): RefDataItem {
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml) as Record<string, unknown>;
  } catch {
    return EMPTY_ITEM;
  }

  // Navigate: Envelope → Body → GLN_DETAILResponse → GLN_DETAILResult
  const envelope = (doc["soap:Envelope"] ?? doc["Envelope"] ?? {}) as Record<string, unknown>;
  const body     = (envelope["soap:Body"] ?? envelope["Body"] ?? {}) as Record<string, unknown>;

  // The response element name may include a namespace prefix
  const responseKey = Object.keys(body).find((k) => k.includes("GLN_DETAILResponse")) ?? "";
  const response    = (body[responseKey] ?? {}) as Record<string, unknown>;

  const resultKey = Object.keys(response).find((k) => k.includes("GLN_DETAILResult")) ?? "";
  const result    = (response[resultKey] ?? {}) as Record<string, unknown>;

  const resultBlock = (result["RESULT"] ?? {}) as Record<string, unknown>;
  const okError     = str(resultBlock["OK_ERROR"]);

  const item        = (result["ITEM"] ?? {}) as Record<string, unknown>;

  // ROLE can be a single object or an array — take the first entry
  const rawRole  = item["ROLE"];
  const role     = (Array.isArray(rawRole) ? rawRole[0] : rawRole ?? {}) as Record<string, unknown>;

  return {
    okError,
    ptype:    str(item["PTYPE"]),
    gln:      str(item["GLN"]),
    descr1:   str(item["DESCR1"]),
    descr2:   str(item["DESCR2"]),
    roleType: str(role["TYPE"]),
    street:   str(role["STREET"]),
    streetNo: str(role["STRNO"]),
    zip:      str(role["ZIP"]),
    city:     str(role["CITY"]),
    canton:   str(role["CTN"]),
    country:  str(role["CNTRY"]),
  };
}
