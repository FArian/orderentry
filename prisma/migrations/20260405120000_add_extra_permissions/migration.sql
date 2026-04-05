-- Migration: add extraPermissions column to User
-- Individual permissions granted beyond the user's base role.
-- Stored as JSON array string, default empty array.

ALTER TABLE "User" ADD COLUMN "extraPermissions" TEXT NOT NULL DEFAULT '[]';
