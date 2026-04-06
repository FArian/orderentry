import { EnvConfig } from "@/infrastructure/config/EnvConfig";

export const fhirBase: string = EnvConfig.fhirBaseUrl;

export const sasísApiBase: string = EnvConfig.sasisApiBase;

// true only when SASIS_API_BASE is explicitly configured
export const sasísEnabled: boolean =
  process.env.NEXT_PUBLIC_SASIS_ENABLED === 'true';

export const glnApiBase: string =
  process.env.GLN_API_BASE || 'http://orchestra:8019/middleware/gln/api/versionVal/refdata/partner/';

export const glnEnabled: boolean =
  process.env.NEXT_PUBLIC_GLN_ENABLED === 'true';
