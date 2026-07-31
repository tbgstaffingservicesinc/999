import { PurchaseService } from "./purchase-service";
import type { PurchaseEngineDependencies, PurchaseRequest, PurchaseResult } from "./types";
export class PurchaseEngine {
 private readonly service:PurchaseService;
 constructor(dependencies:PurchaseEngineDependencies){this.service=new PurchaseService(dependencies);}
 execute(request:PurchaseRequest):Promise<PurchaseResult>{return this.service.prepare(request);}
 purchaseNumbers(request:PurchaseRequest):Promise<PurchaseResult>{return this.service.prepare(request);}
}
