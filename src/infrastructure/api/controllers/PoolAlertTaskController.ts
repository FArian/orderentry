/**
 * PoolAlertTaskController — manages pool alert AdminTasks.
 *
 * GET  /api/v1/admin/pool-tasks         → list open pool alert tasks
 * POST /api/v1/admin/pool-tasks/:id/resolve → resolve a task
 */

import type { IAdminTaskRepository } from "@/application/interfaces/repositories/IAdminTaskRepository";
import { adminTaskRepository }       from "@/infrastructure/repositories/PrismaAdminTaskRepository";
import { createLogger }              from "@/infrastructure/logging/Logger";

const log = createLogger("PoolAlertTaskController");

export class PoolAlertTaskController {
  constructor(private readonly repo: IAdminTaskRepository) {}

  async list() {
    const tasks = await this.repo.findOpen("ORDER_NUMBER_POOL_ALERT");
    const total = tasks.length;
    log.debug("Pool alert tasks listed", { total });
    return { data: tasks, total };
  }

  async resolve(id: string) {
    try {
      const task = await this.repo.resolve(id);
      log.info("Pool alert task resolved", { id, serviceType: task.serviceType });
      return { data: task };
    } catch {
      return { httpStatus: 404, error: "Task nicht gefunden" };
    }
  }
}

export const poolAlertTaskController = new PoolAlertTaskController(adminTaskRepository);
