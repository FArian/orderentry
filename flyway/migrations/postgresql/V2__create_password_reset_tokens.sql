-- V2: Create password reset tokens table

CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
    token       TEXT        NOT NULL PRIMARY KEY,
    "userId"    TEXT        NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");
