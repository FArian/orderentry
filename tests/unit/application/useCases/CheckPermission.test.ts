import { describe, it, expect } from "vitest";
import { checkPermission }      from "@/application/useCases/CheckPermission";
import { PERMISSIONS }          from "@/domain/valueObjects/Permission";

describe("checkPermission", () => {

  describe("admin role", () => {
    it("grants order:create",  () => expect(checkPermission("admin", PERMISSIONS.ORDER_CREATE)).toBe(true));
    it("grants order:read",    () => expect(checkPermission("admin", PERMISSIONS.ORDER_READ)).toBe(true));
    it("grants order:edit",    () => expect(checkPermission("admin", PERMISSIONS.ORDER_EDIT)).toBe(true));
    it("grants patient:read",  () => expect(checkPermission("admin", PERMISSIONS.PATIENT_READ)).toBe(true));
    it("grants patient:edit",  () => expect(checkPermission("admin", PERMISSIONS.PATIENT_EDIT)).toBe(true));
    it("grants gln:read",      () => expect(checkPermission("admin", PERMISSIONS.GLN_READ)).toBe(true));
    it("grants gln:sync",      () => expect(checkPermission("admin", PERMISSIONS.GLN_SYNC)).toBe(true));
    it("grants user:manage",   () => expect(checkPermission("admin", PERMISSIONS.USER_MANAGE)).toBe(true));
    it("grants admin:access",  () => expect(checkPermission("admin", PERMISSIONS.ADMIN_ACCESS)).toBe(true));
  });

  describe("user role", () => {
    it("grants order:create",          () => expect(checkPermission("user", PERMISSIONS.ORDER_CREATE)).toBe(true));
    it("grants order:read",            () => expect(checkPermission("user", PERMISSIONS.ORDER_READ)).toBe(true));
    it("grants patient:read",          () => expect(checkPermission("user", PERMISSIONS.PATIENT_READ)).toBe(true));
    it("grants gln:read",              () => expect(checkPermission("user", PERMISSIONS.GLN_READ)).toBe(true));
    it("denies order:edit",            () => expect(checkPermission("user", PERMISSIONS.ORDER_EDIT)).toBe(false));
    it("denies patient:edit",          () => expect(checkPermission("user", PERMISSIONS.PATIENT_EDIT)).toBe(false));
    it("denies gln:sync",              () => expect(checkPermission("user", PERMISSIONS.GLN_SYNC)).toBe(false));
    it("denies user:manage",           () => expect(checkPermission("user", PERMISSIONS.USER_MANAGE)).toBe(false));
    it("denies admin:access",          () => expect(checkPermission("user", PERMISSIONS.ADMIN_ACCESS)).toBe(false));
  });

  describe("unknown roles", () => {
    it("denies everything for empty string role",  () =>
      expect(checkPermission("", PERMISSIONS.ORDER_READ)).toBe(false));
    it("denies everything for unknown role",       () =>
      expect(checkPermission("superuser", PERMISSIONS.ORDER_READ)).toBe(false));
    it("denies admin:access for unknown role",     () =>
      expect(checkPermission("guest", PERMISSIONS.ADMIN_ACCESS)).toBe(false));
  });

  describe("permission constants shape", () => {
    it("all permission values are colon-separated strings", () => {
      for (const perm of Object.values(PERMISSIONS)) {
        expect(perm).toMatch(/^[a-z]+:[a-z]+$/);
      }
    });
  });
});
