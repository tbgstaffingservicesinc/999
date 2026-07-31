import { randomUUID } from "node:crypto";
import type { PurchaseRepository } from "./types";
export function createPurchaseOperationId(): string { return randomUUID(); }
export class PurchaseIdempotencyHandler {
  constructor(private readonly repository: Pick<PurchaseRepository,"findBatchByIdempotencyKey">) {}
  async findExisting(purchaseOperationId:string){ return this.repository.findBatchByIdempotencyKey(purchaseOperationId); }
}
