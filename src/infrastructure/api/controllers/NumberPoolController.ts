import "@/infrastructure/services/OrderNumberStrategyConfig";
import { createLogger }                  from "@/infrastructure/logging/Logger";
import { reservedNumberRepository }      from "@/infrastructure/repositories/PrismaReservedNumberRepository";
import { orgRuleRepository }             from "@/infrastructure/repositories/PrismaOrgRuleRepository";
import { adminTaskRepository }           from "@/infrastructure/repositories/PrismaAdminTaskRepository";
import { orchestraOrderService }         from "@/infrastructure/services/OrchestraOrderService";
import { PoolNotificationService }       from "@/infrastructure/services/PoolNotificationService";
import { GenerateOrderNumberUseCase, OrderBlockedError } from "@/application/useCases/GenerateOrderNumberUseCase";
import { ReserveOrderNumberUseCase }     from "@/application/useCases/ReserveOrderNumberUseCase";
import { PoolThreshold }                 from "@/domain/valueObjects/PoolThreshold";
import type { AddNumbersDto, OrderNumberRequestDto, UpdatePoolThresholdDto } from "@/infrastructure/api/dto/NumberPoolDto";

const log = createLogger("NumberPoolController");

function buildNotificationService() {
  return new PoolNotificationService(
    reservedNumberRepository,
    adminTaskRepository,
    async (to, subject, text) => {
      // Lazy-import mail service to avoid bundling nodemailer in Edge runtime.
      const { mailService } = await import("@/infrastructure/mail/MailServiceFactory");
      const svc = mailService;
      if (!svc.isConfigured()) {
        log.warn("Mail not configured — pool notification not sent");
        return;
      }
      await svc.send({ to, subject, text, html: `<pre>${text}</pre>` });
    },
  );
}

export class NumberPoolController {
  async listPool() {
    const [data, stats] = await Promise.all([
      reservedNumberRepository.findAll(),
      reservedNumberRepository.stats(),
    ]);
    return { data, stats };
  }

  async addNumbers(body: AddNumbersDto) {
    const { numbers, serviceType, orgFhirId } = body;
    if (!Array.isArray(numbers) || numbers.length === 0) {
      return { httpStatus: 400, error: "numbers array is required and must not be empty" };
    }
    const notifications = buildNotificationService();
    const useCase       = new ReserveOrderNumberUseCase(reservedNumberRepository, notifications);
    const result        = await useCase.execute({ numbers, serviceType, orgFhirId: orgFhirId ?? null });
    const stats         = await reservedNumberRepository.stats();
    log.info("Pool numbers added", { added: result.added, rejected: result.rejected.length });
    return { ...result, stats, httpStatus: result.added > 0 ? 201 : 200 };
  }

  async deleteNumber(id: string) {
    try {
      await reservedNumberRepository.delete(id);
      return { deleted: true };
    } catch {
      return { httpStatus: 404, error: "Reserved number not found" };
    }
  }

  async getThresholds() {
    return reservedNumberRepository.getThresholds();
  }

  async updateThresholds(body: UpdatePoolThresholdDto) {
    try {
      new PoolThreshold(body); // validates
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { httpStatus: 400, error: message };
    }
    await reservedNumberRepository.setThresholds(body);
    log.info("Pool thresholds updated", body as unknown as Record<string, unknown>);
    return { updated: true };
  }

  async generateOrderNumber(body: OrderNumberRequestDto) {
    if (!body.serviceType) {
      return { httpStatus: 400, error: "serviceType is required" };
    }
    const notifications = buildNotificationService();
    const useCase       = new GenerateOrderNumberUseCase(
      orchestraOrderService,
      reservedNumberRepository,
      notifications,
      orgRuleRepository,
    );
    try {
      const result = await useCase.execute(body);
      log.info("Order number generated", result as unknown as Record<string, unknown>);
      return result;
    } catch (err) {
      if (err instanceof OrderBlockedError) {
        return { httpStatus: 503, error: err.message };
      }
      const message = err instanceof Error ? err.message : String(err);
      log.error("Order number generation failed", { message });
      return { httpStatus: 500, error: message };
    }
  }
}

export const numberPoolController = new NumberPoolController();
