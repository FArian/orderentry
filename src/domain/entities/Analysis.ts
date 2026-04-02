// Domain entity — framework-independent, no React, no API calls.

export interface Analysis {
  id: string;
  code: string;
  display: string;
  category: string;
  unit?: string;
  dataType?: string;
  specimenType?: string;
}
