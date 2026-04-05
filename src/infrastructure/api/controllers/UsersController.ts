/**
 * UsersController — handles all /api/users endpoints.
 *
 * Reads/writes the JSON user store and triggers FHIR synchronisation.
 * All mutating operations require admin role (enforced in routes, not here).
 *
 * Pattern matches PatientsController / OrdersController:
 *   - Constructor-injectable fetchFn for testability
 *   - Returns typed DTOs (never NextResponse)
 *   - httpStatus field stripped by the route before sending
 */

import {
  getUsers,
  getUserById,
  findUser,
  createUser,
  createExternalUser,
  updateUser,
  deleteUser,
  updateUserFhirSync,
  validateCredentials,
  setApiToken,
  clearApiToken,
  updateExtraPermissions,
} from "@/lib/userStore";
import { apiTokenService } from "@/infrastructure/auth/ApiTokenService";
import { createLogger, type Logger } from "@/infrastructure/logging/Logger";
import { practitionerMapper, PractitionerMapper } from "@/infrastructure/fhir/PractitionerMapper";
import type {
  CreateUserRequestDto,
  DeleteUserResponseDto,
  ListUsersQueryDto,
  PagedUsersResponseDto,
  UpdatePermissionsRequestDto,
  UpdatePermissionsResponseDto,
  UpdateUserRequestDto,
  UserResponseDto,
  UserSyncResponseDto,
} from "../dto/UserDto";
import { ASSIGNABLE_PERMISSIONS } from "@/domain/valueObjects/Permission";
import type { UserRole, UserStatus } from "@/domain/entities/ManagedUser";
import type { User } from "@/lib/userStore";

// ── Mapping helper ─────────────────────────────────────────────────────────────

function toDto(u: User): UserResponseDto {
  return {
    id:             u.id,
    username:       u.username,
    role:           u.role ?? "user",
    status:         u.status ?? "active",
    providerType:   u.providerType ?? "local",
    createdAt:      u.createdAt,
    profile:        u.profile ?? {},
    fhirSyncStatus: u.fhirSyncStatus ?? "not_synced",
    extraPermissions: u.extraPermissions ?? [],
    ...(u.externalId            !== undefined ? { externalId:            u.externalId            } : {}),
    ...(u.fhirSyncedAt          !== undefined ? { fhirSyncedAt:          u.fhirSyncedAt          } : {}),
    ...(u.fhirSyncError         !== undefined ? { fhirSyncError:         u.fhirSyncError         } : {}),
    ...(u.fhirPractitionerId    !== undefined ? { fhirPractitionerId:    u.fhirPractitionerId    } : {}),
    ...(u.fhirPractitionerRoleId !== undefined ? { fhirPractitionerRoleId: u.fhirPractitionerRoleId } : {}),
  };
}

// ── Controller ────────────────────────────────────────────────────────────────

export class UsersController {
  private readonly log: Logger;
  private readonly mapper: PractitionerMapper;

  constructor(
    mapper?: PractitionerMapper,
    logger?: Logger,
  ) {
    this.log   = logger ?? createLogger("UsersController");
    this.mapper = mapper ?? practitionerMapper;
  }

  // ── List ───────────────────────────────────────────────────────────────────

  async list(query: ListUsersQueryDto): Promise<PagedUsersResponseDto> {
    const { q = "", role, status, page = 1, pageSize = 20 } = query;
    const safePage     = Math.max(1, page);
    const safePageSize = Math.max(1, Math.min(pageSize, 100));

    this.log.debug("list Users", { q, role, status, page: safePage });

    try {
      let users = await getUsers();

      // Filters
      if (q)      users = users.filter((u) => u.username.toLowerCase().includes(q.toLowerCase()));
      if (role)   users = users.filter((u) => (u.role ?? "user") === role);
      if (status) users = users.filter((u) => (u.status ?? "active") === status);

      const total = users.length;
      const sliced = users.slice((safePage - 1) * safePageSize, safePage * safePageSize);

      this.log.info("Users listed", { count: sliced.length, total });
      return { data: sliced.map(toDto), total, page: safePage, pageSize: safePageSize };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.error("User list threw", { message });
      return { data: [], total: 0, page: safePage, pageSize: safePageSize, error: message, httpStatus: 500 };
    }
  }

  // ── Get by ID ──────────────────────────────────────────────────────────────

  async getById(id: string): Promise<UserResponseDto | { error: string; httpStatus: number }> {
    this.log.debug("getById User", { id });
    try {
      const user = await getUserById(id);
      if (!user) return { error: "User not found", httpStatus: 404 };
      return toDto(user);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.error("User getById threw", { id, message });
      return { error: message, httpStatus: 500 };
    }
  }

  // ── Create ─────────────────────────────────────────────────────────────────

  async create(body: CreateUserRequestDto): Promise<UserResponseDto | { error: string; httpStatus: number }> {
    this.log.info("create User", { username: body.username, providerType: body.providerType });

    const providerType = body.providerType ?? "local";

    // Validate username
    if (!body.username) return { error: "username is required", httpStatus: 400 };

    // Check uniqueness
    const existing = await findUser(body.username);
    if (existing) return { error: "Username already exists", httpStatus: 409 };

    try {
      let user: User;

      if (providerType === "external") {
        if (!body.externalId) return { error: "externalId is required for external users", httpStatus: 400 };
        user = await createExternalUser({
          username:   body.username,
          externalId: body.externalId,
          status:     body.status ?? "pending",
          ...(body.role    !== undefined ? { role:    body.role    } : {}),
          ...(body.profile !== undefined ? { profile: body.profile } : {}),
        });
      } else {
        // Local user — validate credentials
        const validationError = validateCredentials(body.username, body.password ?? "");
        if (validationError) return { error: validationError, httpStatus: 400 };
        user = await createUser(body.username, body.password!);
        // Apply optional extras
        if (body.role !== undefined || body.status !== undefined || body.profile !== undefined) {
          user = await updateUser(user.id, {
            ...(body.role    !== undefined ? { role:    body.role    } : {}),
            ...(body.status  !== undefined ? { status:  body.status  } : {}),
            ...(body.profile !== undefined ? { profile: body.profile } : {}),
          });
        }
      }

      this.log.info("User created", { id: user.id, username: user.username });
      return toDto(user);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.toLowerCase().includes("exists")) return { error: "Username already exists", httpStatus: 409 };
      this.log.error("User create threw", { message });
      return { error: message, httpStatus: 500 };
    }
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  async update(id: string, body: UpdateUserRequestDto): Promise<UserResponseDto | { error: string; httpStatus: number }> {
    this.log.info("update User", { id });
    try {
      const existing = await getUserById(id);
      if (!existing) return { error: "User not found", httpStatus: 404 };

      const patch: Partial<User> = {};
      if (body.role                !== undefined) patch.role                = body.role       as UserRole;
      if (body.status              !== undefined) patch.status              = body.status     as UserStatus;
      if (body.externalId          !== undefined) patch.externalId          = body.externalId;
      if (body.profile             !== undefined) patch.profile             = { ...existing.profile, ...body.profile };
      if (body.fhirPractitionerId  !== undefined) patch.fhirPractitionerId  = body.fhirPractitionerId;

      const updated = await updateUser(id, patch);
      this.log.info("User updated", { id });
      return toDto(updated);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.error("User update threw", { id, message });
      return { error: message, httpStatus: 500 };
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async delete(id: string): Promise<DeleteUserResponseDto> {
    this.log.info("delete User", { id });
    try {
      const existing = await getUserById(id);
      if (!existing) return { deleted: false, error: "User not found", httpStatus: 404 };
      await deleteUser(id);
      this.log.info("User deleted", { id });
      return { deleted: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.error("User delete threw", { id, message });
      return { deleted: false, error: message, httpStatus: 500 };
    }
  }

  // ── Sync to FHIR ──────────────────────────────────────────────────────────

  async syncToFhir(id: string): Promise<UserSyncResponseDto> {
    this.log.info("syncToFhir", { id });
    try {
      const user = await getUserById(id);
      if (!user) return { synced: false, error: "User not found", httpStatus: 404 };

      const profile = user.profile;
      if (!profile?.ptype) {
        return { synced: false, error: "User profile is incomplete (ptype required)", httpStatus: 422 };
      }

      const result = await this.mapper.syncUser(id, profile);

      await updateUserFhirSync(id, {
        fhirSyncStatus: result.success ? "synced" : "error",
        ...(result.success ? { fhirSyncedAt: new Date().toISOString() } : {}),
        ...(result.error           !== undefined ? { fhirSyncError:          result.error           } : {}),
        ...(result.practitionerId  !== undefined ? { fhirPractitionerId:     result.practitionerId  } : {}),
        ...(result.practitionerRoleId !== undefined ? { fhirPractitionerRoleId: result.practitionerRoleId } : {}),
      });

      if (!result.success) {
        this.log.warn("FHIR sync failed", { id, error: result.error });
        return {
          synced: false,
          ...(result.error !== undefined ? { error: result.error } : {}),
          httpStatus: 502,
        };
      }

      this.log.info("FHIR sync success", { id, practitionerId: result.practitionerId });
      return {
        synced: true,
        ...(result.practitionerId     !== undefined ? { fhirPractitionerId:     result.practitionerId     } : {}),
        ...(result.practitionerRoleId !== undefined ? { fhirPractitionerRoleId: result.practitionerRoleId } : {}),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.error("syncToFhir threw", { id, message });
      return { synced: false, error: message, httpStatus: 500 };
    }
  }

  // ── Extra permissions ─────────────────────────────────────────────────────

  async updatePermissions(id: string, body: UpdatePermissionsRequestDto): Promise<UpdatePermissionsResponseDto> {
    this.log.info("updatePermissions", { id, permissions: body.permissions });
    try {
      const user = await getUserById(id);
      if (!user) return { id, extraPermissions: [], error: "User not found", httpStatus: 404 };

      const assignable = new Set<string>(ASSIGNABLE_PERMISSIONS);
      const invalid = body.permissions.filter((p) => !assignable.has(p));
      if (invalid.length > 0) {
        return { id, extraPermissions: [], error: `Unknown permissions: ${invalid.join(", ")}`, httpStatus: 422 };
      }

      const updated = await updateExtraPermissions(id, body.permissions);
      this.log.info("permissions updated", { id, extraPermissions: updated.extraPermissions });
      return { id, extraPermissions: updated.extraPermissions ?? [] };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.error("updatePermissions threw", { id, message });
      return { id, extraPermissions: [], error: message, httpStatus: 500 };
    }
  }

  // ── API token management (PAT) ─────────────────────────────────────────────

  async generateToken(id: string): Promise<
    { token: string; createdAt: string } | { error: string; httpStatus: number }
  > {
    try {
      const user = await getUserById(id);
      if (!user) return { error: "User not found", httpStatus: 404 };
      if (user.role !== "admin") return { error: "Only admin users may hold API tokens", httpStatus: 403 };
      const plaintext = apiTokenService.generate();
      const hash      = apiTokenService.hash(plaintext);
      const createdAt = new Date().toISOString();
      await setApiToken(id, hash);
      this.log.info("API token generated", { id });
      return { token: plaintext, createdAt };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.error("generateToken threw", { id, message });
      return { error: message, httpStatus: 500 };
    }
  }

  async revokeToken(id: string): Promise<
    { revoked: boolean } | { error: string; httpStatus: number }
  > {
    try {
      const user = await getUserById(id);
      if (!user) return { error: "User not found", httpStatus: 404 };
      await clearApiToken(id);
      this.log.info("API token revoked", { id });
      return { revoked: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.error("revokeToken threw", { id, message });
      return { error: message, httpStatus: 500 };
    }
  }
}

/** Production singleton. */
export const usersController = new UsersController();
