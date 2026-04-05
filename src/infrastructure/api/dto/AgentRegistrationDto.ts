export interface RegisterAgentRequestDto {
  name: string;
  orgFhirId: string;
  orgGln?: string;
  locationId?: string;
}

export interface RegisterAgentResponseDto {
  id: string;
  name: string;
  orgFhirId: string;
  orgGln: string | null;
  locationId: string | null;
  apiKey: string;        // plaintext — shown ONCE, never stored
  apiKeyPrefix: string;  // for display in UI
  status: string;
  createdAt: string;
}

export interface AgentRegistrationResponseDto {
  id: string;
  name: string;
  orgFhirId: string;
  orgGln: string | null;
  locationId: string | null;
  apiKeyPrefix: string;
  status: string;
  lastSeenAt: string | null;
  agentVersion: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListAgentsResponseDto {
  agents: AgentRegistrationResponseDto[];
  total: number;
}
