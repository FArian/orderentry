export const fhirBase: string =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_FHIR_BASE) ||
  'https://hapi.fhir.org/baseR4';

