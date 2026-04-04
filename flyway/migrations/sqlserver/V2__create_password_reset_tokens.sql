-- V2: Create password reset tokens table

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PasswordResetToken')
BEGIN
    CREATE TABLE [PasswordResetToken] (
        token       NVARCHAR(64)   NOT NULL PRIMARY KEY,
        [userId]    NVARCHAR(36)   NOT NULL,
        [expiresAt] DATETIMEOFFSET NOT NULL,
        [createdAt] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT [FK_ResetToken_User] FOREIGN KEY ([userId])
            REFERENCES [User](id) ON DELETE CASCADE
    );

    CREATE INDEX [PasswordResetToken_userId_idx] ON [PasswordResetToken]([userId]);
END
