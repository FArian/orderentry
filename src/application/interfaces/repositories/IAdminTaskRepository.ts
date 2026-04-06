import type { AdminTask, AdminTaskInput, AdminTaskType } from "@/domain/entities/AdminTask";

export interface IAdminTaskRepository {
  /** Create a new admin task (always OPEN). */
  create(input: AdminTaskInput): Promise<AdminTask>;

  /** Return all OPEN tasks, optionally filtered by type. */
  findOpen(type?: AdminTaskType): Promise<AdminTask[]>;

  /**
   * Find the latest OPEN task matching type + serviceType.
   * Used for deduplication — only one open alert per (type, serviceType) at a time.
   */
  findOpenByTypeAndServiceType(
    type:        AdminTaskType,
    serviceType: string,
  ): Promise<AdminTask | null>;

  /** Mark a task as RESOLVED (sets resolvedAt). */
  resolve(id: string): Promise<AdminTask>;

  /** Count of all OPEN tasks. Used for sidebar badge. */
  countOpen(): Promise<number>;
}
