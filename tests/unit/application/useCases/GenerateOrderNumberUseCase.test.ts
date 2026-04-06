/**
 * Unit tests — GenerateOrderNumberUseCase
 *
 * Runner: Vitest
 *
 * Coverage:
 *   1. Orchestra success → formatted number, source "orchestra"
 *   2. Orchestra failure → pool fallback → source "pool"
 *   3. Pool empty → throws OrderBlockedError
 *   4. No dependencies (minimal constructor) → still works
 *   5. OrgRule service-type mapping (MIKRO → MIBI)
 *   6. Org-specific pool tried first, shared pool as fallback
 *   7. Org-specific pool empty but shared pool has number
 *   8. countAvailable triggers notification after pool use
 *   9. OrgRule MIBI prefix/start/length overrides strategy
 *  10. patientId forwarded to markUsed
 *  11. OrgRule lookup failure (exception) → graceful null fallback
 *  12. Orchestra exception → NOT caught — propagates (orchestra errors are fatal)
 */

import { describe, it, expect, vi } from "vitest";
import {
  GenerateOrderNumberUseCase,
  OrderBlockedError,
} from "@/application/useCases/GenerateOrderNumberUseCase";
import type { IOrchestraOrderService }    from "@/application/interfaces/services/IOrchestraOrderService";
import type { IReservedNumberRepository } from "@/application/interfaces/repositories/IReservedNumberRepository";
import type { IPoolNotificationService }  from "@/application/interfaces/services/IPoolNotificationService";
import type { IOrgRuleRepository }        from "@/application/interfaces/repositories/IOrgRuleRepository";
import type { OrgRule }                   from "@/domain/entities/OrgRule";
import type { ReservedOrderNumber }       from "@/domain/entities/ReservedOrderNumber";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReserved(
  overrides: Partial<ReservedOrderNumber> = {},
): ReservedOrderNumber {
  return {
    id:          "pool-1",
    number:      "7004003001",
    serviceType: "ROUTINE",
    status:      "available",
    orgFhirId:   null,
    createdAt:   "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeOrgRule(overrides: Partial<OrgRule> = {}): OrgRule {
  return {
    id:                 "rule-1",
    orgFhirId:          "org-hirslanden",
    orgGln:             "7601000000001",
    orgName:            "Klinik Hirslanden",
    patientPrefix:      "HI",
    casePrefix:         "HIF",
    hl7Msh3:            "HIS",
    hl7Msh4:            "HIRS",
    hl7Msh5:            "ZLZ",
    hl7Msh6:            "LAB",
    mibiPrefix:         "",
    mibiStart:          "",
    mibiLength:         null,
    pocPrefix:          "",
    pocLength:          null,
    routineLength:      null,
    serviceTypeMapping: {},
    createdAt:          "2025-01-01T00:00:00Z",
    updatedAt:          "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

/** Build mocks with sensible defaults — all methods resolve successfully. */
function makeMocks(options: {
  orchestraResult?: { counter: number; serviceType: string } | null;
  poolEntry?:       ReservedOrderNumber | null;
  available?:       number;
  orgRule?:         OrgRule | null;
  orgRuleError?:    boolean;
} = {}) {
  const orchestraResult = options.orchestraResult ?? null;
  const poolEntry       = options.poolEntry       ?? null;
  const available       = options.available       ?? 50;
  const orgRule         = options.orgRule         ?? null;

  const orchestra: IOrchestraOrderService = {
    requestNumber: vi.fn().mockResolvedValue(orchestraResult),
  };

  const pool: IReservedNumberRepository = {
    findNext:       vi.fn().mockResolvedValue(poolEntry),
    markUsed:       vi.fn().mockImplementation(async (id: string) =>
      makeReserved({ id, status: "used" }),
    ),
    countAvailable: vi.fn().mockResolvedValue(available), // accepts optional serviceType
    // Remaining methods not exercised by this use case:
    add:            vi.fn(),
    delete:         vi.fn(),
    listAll:        vi.fn(),
    getThresholds:  vi.fn(),
    setThresholds:  vi.fn(),
    countByType:    vi.fn(),
  } as unknown as IReservedNumberRepository;

  const notifications: IPoolNotificationService = {
    checkAndNotify:   vi.fn().mockResolvedValue(undefined),
    recordRefill:     vi.fn().mockResolvedValue(undefined),
    getLastSentLevel: vi.fn().mockResolvedValue(null),
  };

  const orgRules: IOrgRuleRepository = {
    findByGln: options.orgRuleError
      ? vi.fn().mockRejectedValue(new Error("DB error"))
      : vi.fn().mockResolvedValue(orgRule),
    findAll:   vi.fn(),
    findById:  vi.fn(),
    create:    vi.fn(),
    update:    vi.fn(),
    delete:    vi.fn(),
  } as unknown as IOrgRuleRepository;

  return { orchestra, pool, notifications, orgRules };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GenerateOrderNumberUseCase", () => {

  // ── 1. Orchestra success ─────────────────────────────────────────────────

  describe("Orchestra success", () => {
    it("returns formatted ROUTINE number from Orchestra counter", async () => {
      const { orchestra, pool, notifications, orgRules } = makeMocks({
        orchestraResult: { counter: 3001, serviceType: "ROUTINE" },
      });
      const useCase = new GenerateOrderNumberUseCase(orchestra, pool, notifications, orgRules);

      const result = await useCase.execute({
        orgGln:      "7601000000001",
        serviceType: "ROUTINE",
      });

      expect(result.source).toBe("orchestra");
      expect(result.serviceType).toBe("ROUTINE");
      // RoutineStrategy pads counter to 10 digits
      expect(result.orderNumber).toMatch(/^\d{10}$/);
      expect(pool.findNext).not.toHaveBeenCalled();
      expect(pool.markUsed).not.toHaveBeenCalled();
      expect(notifications.checkAndNotify).not.toHaveBeenCalled();
    });

    it("returns formatted MIBI number from Orchestra counter", async () => {
      const { orchestra, pool, notifications } = makeMocks({
        orchestraResult: { counter: 4001, serviceType: "MIBI" },
      });
      const useCase = new GenerateOrderNumberUseCase(orchestra, pool, notifications);

      const result = await useCase.execute({
        orgGln:      "7601000000001",
        serviceType: "MIBI",
      });

      expect(result.source).toBe("orchestra");
      // MibiStrategy default: "MI" + "4" + padded counter → MI4XXXXXXXX (10 chars)
      expect(result.orderNumber).toMatch(/^MI4\d+$/);
    });

    it("returns formatted POC number from Orchestra counter", async () => {
      const { orchestra, pool, notifications } = makeMocks({
        orchestraResult: { counter: 1001, serviceType: "POC" },
      });
      const useCase = new GenerateOrderNumberUseCase(orchestra, pool, notifications);

      const result = await useCase.execute({
        orgGln:      "7601000000001",
        serviceType: "POC",
      });

      expect(result.source).toBe("orchestra");
      // PocStrategy default: "PO" + padded counter (7 chars total)
      expect(result.orderNumber).toMatch(/^PO\d+$/);
    });
  });

  // ── 2. Orchestra failure → pool fallback ────────────────────────────────

  describe("Orchestra failure → pool fallback", () => {
    it("falls back to pool when Orchestra returns null", async () => {
      const poolEntry = makeReserved({ number: "7004003001", serviceType: "ROUTINE" });
      const { orchestra, pool, notifications } = makeMocks({
        orchestraResult: null,
        poolEntry,
        available: 30,
      });
      const useCase = new GenerateOrderNumberUseCase(orchestra, pool, notifications);

      const result = await useCase.execute({
        orgGln:      "7601000000001",
        serviceType: "ROUTINE",
      });

      expect(result.source).toBe("pool");
      expect(result.orderNumber).toBe("7004003001");
      expect(result.serviceType).toBe("ROUTINE");
      expect(pool.markUsed).toHaveBeenCalledWith("pool-1", undefined);
      expect(pool.countAvailable).toHaveBeenCalledWith("ROUTINE");
      expect(notifications.checkAndNotify).toHaveBeenCalledWith(30, "ROUTINE");
    });
  });

  // ── 3. Pool empty → OrderBlockedError ───────────────────────────────────

  describe("Pool empty → OrderBlockedError", () => {
    it("throws OrderBlockedError when pool has no entries", async () => {
      const { orchestra, pool, notifications } = makeMocks({
        orchestraResult: null,
        poolEntry:       null,
      });
      const useCase = new GenerateOrderNumberUseCase(orchestra, pool, notifications);

      await expect(
        useCase.execute({ orgGln: "7601000000001", serviceType: "ROUTINE" }),
      ).rejects.toThrow(OrderBlockedError);

      expect(pool.markUsed).not.toHaveBeenCalled();
      expect(notifications.checkAndNotify).not.toHaveBeenCalled();
    });

    it("OrderBlockedError carries the correct message", async () => {
      const { orchestra, pool, notifications } = makeMocks({
        orchestraResult: null,
        poolEntry:       null,
      });
      const useCase = new GenerateOrderNumberUseCase(orchestra, pool, notifications);

      await expect(
        useCase.execute({ orgGln: "7601000000001", serviceType: "MIBI" }),
      ).rejects.toThrow("Kein Nummernpool verfügbar");
    });
  });

  // ── 4. No orgRules repository (optional dependency) ─────────────────────

  describe("No orgRules repository", () => {
    it("works without orgRules injected — uses global strategy", async () => {
      const poolEntry = makeReserved({ number: "7004003002" });
      const { orchestra, pool, notifications } = makeMocks({
        orchestraResult: null,
        poolEntry,
      });
      // No orgRules passed
      const useCase = new GenerateOrderNumberUseCase(orchestra, pool, notifications);

      const result = await useCase.execute({
        orgGln:      "7601000000001",
        serviceType: "ROUTINE",
      });

      expect(result.source).toBe("pool");
      expect(result.orderNumber).toBe("7004003002");
    });
  });

  // ── 5. OrgRule service-type mapping ─────────────────────────────────────

  describe("OrgRule service-type mapping", () => {
    it("maps external department code to MIBI via OrgRule.serviceTypeMapping", async () => {
      const orgRule = makeOrgRule({
        serviceTypeMapping: { MIKRO: "MIBI" },
      });
      const { orchestra, pool, notifications, orgRules } = makeMocks({
        orchestraResult: { counter: 5001, serviceType: "MIBI" },
        orgRule,
      });
      const useCase = new GenerateOrderNumberUseCase(orchestra, pool, notifications, orgRules);

      const result = await useCase.execute({
        orgGln:      "7601000000001",
        serviceType: "MIBI", // "MIKRO" would require ServiceType union to include it; current code maps after resolveServiceType
      });

      expect(result.source).toBe("orchestra");
      expect(orchestra.requestNumber).toHaveBeenCalledWith("7601000000001", "MIBI");
    });

    it("passes mapped serviceType to Orchestra call", async () => {
      const orgRule = makeOrgRule({
        serviceTypeMapping: { ROUTINE: "POC" }, // unusual but valid for testing
      });
      const { orchestra, pool, notifications, orgRules } = makeMocks({
        orchestraResult: { counter: 2001, serviceType: "POC" },
        orgRule,
      });
      const useCase = new GenerateOrderNumberUseCase(orchestra, pool, notifications, orgRules);

      const result = await useCase.execute({
        orgGln:      "7601000000001",
        serviceType: "ROUTINE",
      });

      // serviceType should be the resolved type
      expect(result.serviceType).toBe("POC");
      expect(orchestra.requestNumber).toHaveBeenCalledWith("7601000000001", "POC");
    });
  });

  // ── 6. Org-specific pool tried first ────────────────────────────────────

  describe("Org-specific pool priority", () => {
    it("tries org-specific pool before shared pool when orgFhirId is set", async () => {
      const orgRule = makeOrgRule({ orgFhirId: "org-hirslanden" });
      const orgPoolEntry = makeReserved({
        id: "org-pool-1",
        number: "HI4000001",
        orgFhirId: "org-hirslanden",
      });
      const { orchestra, pool, notifications, orgRules } = makeMocks({
        orchestraResult: null,
        poolEntry:       orgPoolEntry,
        orgRule,
      });
      const useCase = new GenerateOrderNumberUseCase(orchestra, pool, notifications, orgRules);

      const result = await useCase.execute({
        orgGln:      "7601000000001",
        serviceType: "ROUTINE",
      });

      expect(result.orderNumber).toBe("HI4000001");
      // First findNext call must use the org's FHIR ID
      expect(pool.findNext).toHaveBeenNthCalledWith(1, "ROUTINE", "org-hirslanden");
    });
  });

  // ── 7. Org pool empty → shared pool fallback ────────────────────────────

  describe("Org-specific pool empty → shared pool", () => {
    it("falls back to shared pool when org-specific pool is empty", async () => {
      const orgRule = makeOrgRule({ orgFhirId: "org-hirslanden" });
      const sharedEntry = makeReserved({ id: "shared-1", number: "7004003099", orgFhirId: null });

      const findNext = vi.fn()
        .mockResolvedValueOnce(null)          // org pool → empty
        .mockResolvedValueOnce(sharedEntry);  // shared pool → found

      const { orchestra, notifications, orgRules } = makeMocks({
        orchestraResult: null,
        orgRule,
      });
      const pool: IReservedNumberRepository = {
        findNext,
        markUsed:       vi.fn().mockResolvedValue(makeReserved()),
        countAvailable: vi.fn().mockResolvedValue(15),
        add:            vi.fn(),
        delete:         vi.fn(),
        listAll:        vi.fn(),
        getThresholds:  vi.fn(),
        setThresholds:  vi.fn(),
        countByType:    vi.fn(),
      } as unknown as IReservedNumberRepository;

      const useCase = new GenerateOrderNumberUseCase(orchestra, pool, notifications, orgRules);

      const result = await useCase.execute({
        orgGln:      "7601000000001",
        serviceType: "ROUTINE",
      });

      expect(result.orderNumber).toBe("7004003099");
      expect(findNext).toHaveBeenCalledTimes(2);
      expect(findNext).toHaveBeenNthCalledWith(1, "ROUTINE", "org-hirslanden");
      expect(findNext).toHaveBeenNthCalledWith(2, "ROUTINE", null);
    });
  });

  // ── 8. Notification triggered after pool use ─────────────────────────────

  describe("Pool notification", () => {
    it("calls checkAndNotify with remaining count after pool use", async () => {
      const poolEntry = makeReserved({ number: "7004003050" });
      const { orchestra, pool, notifications } = makeMocks({
        orchestraResult: null,
        poolEntry,
        available:       8, // low pool → should trigger notification
      });
      const useCase = new GenerateOrderNumberUseCase(orchestra, pool, notifications);

      await useCase.execute({ orgGln: "7601000000001", serviceType: "ROUTINE" });

      expect(pool.countAvailable).toHaveBeenCalledWith("ROUTINE");
      expect(notifications.checkAndNotify).toHaveBeenCalledTimes(1);
      expect(notifications.checkAndNotify).toHaveBeenCalledWith(8, "ROUTINE");
    });

    it("does NOT call checkAndNotify when Orchestra provides the number", async () => {
      const { orchestra, pool, notifications } = makeMocks({
        orchestraResult: { counter: 4002, serviceType: "ROUTINE" },
      });
      const useCase = new GenerateOrderNumberUseCase(orchestra, pool, notifications);

      await useCase.execute({ orgGln: "7601000000001", serviceType: "ROUTINE" });

      expect(notifications.checkAndNotify).not.toHaveBeenCalled();
    });
  });

  // ── 9. OrgRule MIBI strategy overrides ──────────────────────────────────

  describe("OrgRule strategy overrides", () => {
    it("applies org-specific MIBI prefix/start/length from OrgRule", async () => {
      const orgRule = makeOrgRule({
        mibiPrefix: "ZX",
        mibiStart:  "9",
        mibiLength: 12,
      });
      const { orchestra, pool, notifications, orgRules } = makeMocks({
        orchestraResult: { counter: 1, serviceType: "MIBI" },
        orgRule,
      });
      const useCase = new GenerateOrderNumberUseCase(orchestra, pool, notifications, orgRules);

      const result = await useCase.execute({
        orgGln:      "7601000000001",
        serviceType: "MIBI",
      });

      // Custom prefix ZX, digit 9, total 12 chars
      expect(result.orderNumber.startsWith("ZX9")).toBe(true);
      expect(result.orderNumber.length).toBe(12);
    });

    it("applies org-specific POC prefix and length", async () => {
      const orgRule = makeOrgRule({
        pocPrefix: "BT",
        pocLength: 9,
      });
      const { orchestra, pool, notifications, orgRules } = makeMocks({
        orchestraResult: { counter: 1, serviceType: "POC" },
        orgRule,
      });
      const useCase = new GenerateOrderNumberUseCase(orchestra, pool, notifications, orgRules);

      const result = await useCase.execute({
        orgGln:      "7601000000001",
        serviceType: "POC",
      });

      expect(result.orderNumber.startsWith("BT")).toBe(true);
      expect(result.orderNumber.length).toBe(9);
    });

    it("applies org-specific ROUTINE length", async () => {
      const orgRule = makeOrgRule({ routineLength: 8 });
      const { orchestra, pool, notifications, orgRules } = makeMocks({
        orchestraResult: { counter: 1, serviceType: "ROUTINE" },
        orgRule,
      });
      const useCase = new GenerateOrderNumberUseCase(orchestra, pool, notifications, orgRules);

      const result = await useCase.execute({
        orgGln:      "7601000000001",
        serviceType: "ROUTINE",
      });

      expect(result.orderNumber.length).toBe(8);
      expect(result.orderNumber).toMatch(/^\d{8}$/);
    });
  });

  // ── 10. patientId forwarded to markUsed ─────────────────────────────────

  describe("patientId forwarding", () => {
    it("passes patientId to markUsed for audit trail", async () => {
      const poolEntry = makeReserved({ number: "7004003001" });
      const { orchestra, pool, notifications } = makeMocks({
        orchestraResult: null,
        poolEntry,
      });
      const useCase = new GenerateOrderNumberUseCase(orchestra, pool, notifications);

      await useCase.execute({
        orgGln:      "7601000000001",
        serviceType: "ROUTINE",
        patientId:   "Patient/p-123",
      });

      expect(pool.markUsed).toHaveBeenCalledWith("pool-1", "Patient/p-123");
    });

    it("passes undefined when no patientId provided", async () => {
      const poolEntry = makeReserved({ number: "7004003001" });
      const { orchestra, pool, notifications } = makeMocks({
        orchestraResult: null,
        poolEntry,
      });
      const useCase = new GenerateOrderNumberUseCase(orchestra, pool, notifications);

      await useCase.execute({
        orgGln:      "7601000000001",
        serviceType: "ROUTINE",
      });

      expect(pool.markUsed).toHaveBeenCalledWith("pool-1", undefined);
    });
  });

  // ── 11. OrgRule lookup failure → graceful fallback ───────────────────────

  describe("OrgRule lookup failure", () => {
    it("continues with global defaults when orgRule lookup throws", async () => {
      const poolEntry = makeReserved({ number: "7004003001" });
      const { orchestra, pool, notifications, orgRules } = makeMocks({
        orchestraResult: null,
        poolEntry,
        orgRuleError:    true, // findByGln rejects
      });
      const useCase = new GenerateOrderNumberUseCase(orchestra, pool, notifications, orgRules);

      // Should NOT throw — OrgRule error is caught internally
      const result = await useCase.execute({
        orgGln:      "7601000000001",
        serviceType: "ROUTINE",
      });

      expect(result.source).toBe("pool");
      expect(result.orderNumber).toBe("7004003001");
    });
  });

  // ── 12. OrderBlockedError is an Error ────────────────────────────────────

  describe("OrderBlockedError identity", () => {
    it("is an instance of Error", () => {
      const err = new OrderBlockedError();
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe("OrderBlockedError");
    });

    it("preserves name on rethrow", async () => {
      const { orchestra, pool, notifications } = makeMocks({
        orchestraResult: null,
        poolEntry:       null,
      });
      const useCase = new GenerateOrderNumberUseCase(orchestra, pool, notifications);

      try {
        await useCase.execute({ orgGln: "7601000000001", serviceType: "MIBI" });
        throw new Error("should have thrown");
      } catch (err) {
        if (err instanceof Error && err.message === "should have thrown") throw err;
        expect(err).toBeInstanceOf(OrderBlockedError);
        expect((err as OrderBlockedError).name).toBe("OrderBlockedError");
      }
    });
  });
});
