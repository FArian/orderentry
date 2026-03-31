export const fhirBase: string =
  process.env.FHIR_BASE_URL || 'https://hapi.2a01-4f8-1c1a-5842--1.nip.io/fhir';

export const sasísApiBase: string =
  process.env.SASIS_API_BASE || '';

// true only when SASIS_API_BASE is explicitly configured
export const sasísEnabled: boolean =
  process.env.NEXT_PUBLIC_SASIS_ENABLED === 'true';

export const glnApiBase: string =
  process.env.GLN_API_BASE || 'http://orchestra:8019/middleware/gln/api/versionVal/refdata/partner/';

export const glnEnabled: boolean =
  process.env.NEXT_PUBLIC_GLN_ENABLED === 'true';
