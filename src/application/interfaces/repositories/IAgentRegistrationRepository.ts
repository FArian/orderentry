export interface AgentRegistrationData {
  id: string;
  name: string;
  orgFhirId: string;
  orgGln: string | null;
  locationId: string | null;
  apiKeyHash: string;
  apiKeyPrefix: string;
  status: string;
  lastSeenAt: Date | null;
  agentVersion: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAgentRegistrationInput {
  name: string;
  orgFhirId: string;
  orgGln?: string;
  locationId?: string;
  apiKeyHash: string;
  apiKeyPrefix: string;
}

export interface IAgentRegistrationRepository {
  create(input: CreateAgentRegistrationInput): Promise<AgentRegistrationData>;
  findAll(): Promise<AgentRegistrationData[]>;
  findById(id: string): Promise<AgentRegistrationData | null>;
  findByApiKeyPrefix(prefix: string): Promise<AgentRegistrationData[]>;
  updateLastSeen(id: string, agentVersion?: string): Promise<void>;
  revoke(id: string): Promise<void>;
  delete(id: string): Promise<void>;
}
