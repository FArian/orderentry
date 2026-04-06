import { describe, it, expect } from "vitest";
import { ROLE_PERMISSION_MAP }  from "@/domain/policies/RolePermissionMap";
import { PERMISSIONS }          from "@/domain/valueObjects/Permission";

describe("RolePermissionMap", () => {

  describe("admin role", () => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const grants = ROLE_PERMISSION_MAP["admin"]!;

    it("exists in the map", () => expect(grants).toBeDefined());
    it("has ORDER_CREATE",  () => expect(grants.has(PERMISSIONS.ORDER_CREATE)).toBe(true));
    it("has ORDER_READ",    () => expect(grants.has(PERMISSIONS.ORDER_READ)).toBe(true));
    it("has ORDER_EDIT",    () => expect(grants.has(PERMISSIONS.ORDER_EDIT)).toBe(true));
    it("has PATIENT_READ",  () => expect(grants.has(PERMISSIONS.PATIENT_READ)).toBe(true));
    it("has PATIENT_EDIT",  () => expect(grants.has(PERMISSIONS.PATIENT_EDIT)).toBe(true));
    it("has GLN_READ",      () => expect(grants.has(PERMISSIONS.GLN_READ)).toBe(true));
    it("has GLN_SYNC",      () => expect(grants.has(PERMISSIONS.GLN_SYNC)).toBe(true));
    it("has USER_MANAGE",   () => expect(grants.has(PERMISSIONS.USER_MANAGE)).toBe(true));
    it("has ADMIN_ACCESS",  () => expect(grants.has(PERMISSIONS.ADMIN_ACCESS)).toBe(true));
  });

  describe("user role", () => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const grants = ROLE_PERMISSION_MAP["user"]!;

    it("exists in the map", () => expect(grants).toBeDefined());
    it("has ORDER_CREATE",       () => expect(grants.has(PERMISSIONS.ORDER_CREATE)).toBe(true));
    it("has ORDER_READ",         () => expect(grants.has(PERMISSIONS.ORDER_READ)).toBe(true));
    it("has PATIENT_READ",       () => expect(grants.has(PERMISSIONS.PATIENT_READ)).toBe(true));
    it("has GLN_READ",           () => expect(grants.has(PERMISSIONS.GLN_READ)).toBe(true));
    it("does NOT have ORDER_EDIT",   () => expect(grants.has(PERMISSIONS.ORDER_EDIT)).toBe(false));
    it("does NOT have PATIENT_EDIT", () => expect(grants.has(PERMISSIONS.PATIENT_EDIT)).toBe(false));
    it("does NOT have GLN_SYNC",     () => expect(grants.has(PERMISSIONS.GLN_SYNC)).toBe(false));
    it("does NOT have USER_MANAGE",  () => expect(grants.has(PERMISSIONS.USER_MANAGE)).toBe(false));
    it("does NOT have ADMIN_ACCESS", () => expect(grants.has(PERMISSIONS.ADMIN_ACCESS)).toBe(false));
  });

  describe("unknown role", () => {
    it("is not in the map", () => expect(ROLE_PERMISSION_MAP["superuser"]).toBeUndefined());
    it("is not in the map for guest", () => expect(ROLE_PERMISSION_MAP["guest"]).toBeUndefined());
  });
});
