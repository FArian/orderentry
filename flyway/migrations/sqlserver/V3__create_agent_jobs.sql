-- V3: AgentJob — print and ORU jobs queued for Local Agent polling

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AgentJob' AND xtype='U')
BEGIN
  CREATE TABLE AgentJob (
    id          NVARCHAR(36)  NOT NULL PRIMARY KEY,
    type        NVARCHAR(10)  NOT NULL,
    status      NVARCHAR(10)  NOT NULL DEFAULT 'pending',
    orgId       NVARCHAR(256) NOT NULL,
    locationId  NVARCHAR(256) NULL,
    payload     NVARCHAR(MAX) NOT NULL,
    createdAt   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    updatedAt   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    doneAt      DATETIME2     NULL
  );

  CREATE INDEX idx_agent_job_status_org ON AgentJob (status, orgId);
  CREATE INDEX idx_agent_job_status_loc ON AgentJob (status, orgId, locationId);
END
