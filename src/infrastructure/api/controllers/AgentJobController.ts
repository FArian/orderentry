/**
 * AgentJobController — handles print job queue for Local Agent polling.
 *
 * Responsibilities:
 *   - createPrintJob: create a pending job after order submission
 *   - listJobs:       return pending jobs for a given org/location (Agent polling)
 *   - markDone:       Agent confirms job completed
 *
 * ZPL generation:
 *   One label per specimen, format: "{orderNumber} {materialCode}" as CODE128 barcode.
 *   Labels are concatenated into a single ZPL string stored in the job payload.
 *
 * Routing:
 *   orgId + locationId → targeted (agent of that department)
 *   orgId only         → broadcast (all agents of the organization)
 */

import type { IAgentJobRepository } from "@/application/interfaces/repositories/IAgentJobRepository";
import { agentJobRepository } from "@/infrastructure/repositories/PrismaAgentJobRepository";
import { createLogger } from "@/infrastructure/logging/Logger";
import type {
  CreatePrintJobRequestDto,
  CreatePrintJobResponseDto,
  ListAgentJobsResponseDto,
  JobDoneResponseDto,
  AgentJobResponseDto,
} from "../dto/AgentJobDto";

const log = createLogger("AgentJobController");

function buildZpl(orderNumber: string, specimens: Array<{ materialCode: string; materialName: string }>): string {
  return specimens
    .map(({ materialCode, materialName }) => {
      const barcode = `${orderNumber} ${materialCode}`;
      return [
        "^XA",
        "^PW400",
        "^LL200",
        `^FO20,20^BY2^BCN,80,Y,N,N^FD${barcode}^FS`,
        `^FO20,120^A0N,20,20^FD${materialName}^FS`,
        "^XZ",
      ].join("\n");
    })
    .join("\n");
}

export class AgentJobController {
  constructor(private readonly repo: IAgentJobRepository = agentJobRepository) {}

  // ── POST /api/v1/agent/jobs/print ──────────────────────────────────────────

  async createPrintJob(body: CreatePrintJobRequestDto): Promise<CreatePrintJobResponseDto> {
    if (!body.orgId || !body.documentReferenceId || !body.orderNumber) {
      throw Object.assign(new Error("orgId, documentReferenceId and orderNumber are required"), { status: 400 });
    }

    const zpl = buildZpl(body.orderNumber, body.specimens ?? []);

    const job = await this.repo.create({
      type:                "print",
      orgId:               body.orgId,
      ...(body.locationId ? { locationId: body.locationId } : {}),
      documentReferenceId: body.documentReferenceId,
      serviceRequestId:    body.serviceRequestId,
      patientId:           body.patientId,
      orderNumber:         body.orderNumber,
      zpl,
    });

    log.info(`Print job created: id=${job.id} orgId=${job.orgId} locationId=${job.locationId ?? "broadcast"}`);

    return { id: job.id, status: job.status, createdAt: job.createdAt };
  }

  // ── GET /api/v1/agent/jobs ─────────────────────────────────────────────────

  async listJobs(orgId: string, locationId?: string): Promise<ListAgentJobsResponseDto> {
    if (!orgId) {
      throw Object.assign(new Error("orgId query parameter is required"), { status: 400 });
    }

    const jobs = await this.repo.listPending(orgId, locationId);

    const result: AgentJobResponseDto[] = jobs.map((j) => ({
      id:                  j.id,
      type:                j.type,
      orgId:               j.orgId,
      locationId:          j.locationId,
      documentReferenceId: j.payload.documentReferenceId,
      serviceRequestId:    j.payload.serviceRequestId,
      patientId:           j.payload.patientId,
      orderNumber:         j.payload.orderNumber,
      zpl:                 j.payload.zpl,
      createdAt:           j.createdAt,
    }));

    return { jobs: result };
  }

  // ── POST /api/v1/agent/jobs/[id]/done ──────────────────────────────────────

  async markDone(id: string): Promise<JobDoneResponseDto> {
    if (!id) {
      throw Object.assign(new Error("Job id is required"), { status: 400 });
    }

    await this.repo.markDone(id);
    log.info(`Print job marked done: id=${id}`);

    return { id, status: "done" };
  }
}

export const agentJobController = new AgentJobController();
