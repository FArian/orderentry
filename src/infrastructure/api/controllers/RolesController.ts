/**
 * RolesController — handles all /api/roles endpoints.
 *
 * Reads/writes the role catalog via roleStore.ts.
 * GET /api/roles is public (needed by user-form dropdown).
 * POST/PUT/DELETE require admin role (enforced in routes, not here).
 *
 * Pattern mirrors UsersController:
 *  - Returns typed DTOs (never NextResponse)
 *  - httpStatus field stripped by the route before sending
 */

import {
  getRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  type RoleCatalogEntry,
} from "@/lib/roleStore";
import { createLogger, type Logger } from "@/infrastructure/logging/Logger";
import type {
  CreateRoleRequestDto,
  DeleteRoleResponseDto,
  ListRolesResponseDto,
  RoleCatalogEntryDto,
  UpdateRoleRequestDto,
} from "../dto/RoleDto";

// ── Mapping helper ────────────────────────────────────────────────────────────

function toDto(r: RoleCatalogEntry): RoleCatalogEntryDto {
  return {
    id:        r.id,
    code:      r.code,
    display:   r.display,
    createdAt: r.createdAt,
    ...(r.system !== undefined ? { system: r.system } : {}),
  };
}

// ── Controller ────────────────────────────────────────────────────────────────

export class RolesController {
  private readonly log: Logger;

  constructor(logger?: Logger) {
    this.log = logger ?? createLogger("RolesController");
  }

  // ── List ───────────────────────────────────────────────────────────────────

  async list(): Promise<ListRolesResponseDto> {
    this.log.debug("list Roles");
    try {
      const roles = await getRoles();
      this.log.info("Roles listed", { count: roles.length });
      return { data: roles.map(toDto), total: roles.length };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.error("Role list threw", { message });
      return { data: [], error: message, httpStatus: 500 };
    }
  }

  // ── Get by ID ──────────────────────────────────────────────────────────────

  async getById(id: string): Promise<RoleCatalogEntryDto | { error: string; httpStatus: number }> {
    this.log.debug("getById Role", { id });
    try {
      const role = await getRoleById(id);
      if (!role) return { error: "Role not found", httpStatus: 404 };
      return toDto(role);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.error("Role getById threw", { id, message });
      return { error: message, httpStatus: 500 };
    }
  }

  // ── Create ─────────────────────────────────────────────────────────────────

  async create(body: CreateRoleRequestDto): Promise<RoleCatalogEntryDto | { error: string; httpStatus: number }> {
    this.log.info("create Role", { code: body.code });
    if (!body.code?.trim())    return { error: "code is required",    httpStatus: 400 };
    if (!body.display?.trim()) return { error: "display is required", httpStatus: 400 };
    try {
      const role = await createRole({
        code:    body.code,
        display: body.display,
        ...(body.system?.trim() ? { system: body.system } : {}),
      });
      this.log.info("Role created", { id: role.id, code: role.code });
      return toDto(role);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.toLowerCase().includes("already exists")) {
        return { error: message, httpStatus: 409 };
      }
      this.log.error("Role create threw", { message });
      return { error: message, httpStatus: 500 };
    }
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  async update(id: string, body: UpdateRoleRequestDto): Promise<RoleCatalogEntryDto | { error: string; httpStatus: number }> {
    this.log.info("update Role", { id });
    try {
      const existing = await getRoleById(id);
      if (!existing) return { error: "Role not found", httpStatus: 404 };

      const role = await updateRole(id, {
        ...(body.code    !== undefined ? { code:    body.code    } : {}),
        ...(body.display !== undefined ? { display: body.display } : {}),
        ...(body.system  !== undefined ? { system:  body.system  } : {}),
      });
      this.log.info("Role updated", { id });
      return toDto(role);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.toLowerCase().includes("already exists")) {
        return { error: message, httpStatus: 409 };
      }
      this.log.error("Role update threw", { id, message });
      return { error: message, httpStatus: 500 };
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async delete(id: string): Promise<DeleteRoleResponseDto> {
    this.log.info("delete Role", { id });
    try {
      const existing = await getRoleById(id);
      if (!existing) return { deleted: false, error: "Role not found", httpStatus: 404 };
      await deleteRole(id);
      this.log.info("Role deleted", { id });
      return { deleted: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.error("Role delete threw", { id, message });
      return { deleted: false, error: message, httpStatus: 500 };
    }
  }
}

/** Production singleton. */
export const rolesController = new RolesController();
