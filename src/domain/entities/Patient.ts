// Domain entity — framework-independent, no React, no API calls.

export interface Patient {
  id: string;
  name: string;
  birthDate?: string;
  gender?: string;
  active: boolean;
  patientId?: string; // AHV or other external identifier
}
