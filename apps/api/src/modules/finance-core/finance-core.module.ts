import { Global, Module } from '@nestjs/common';
import { FinanceAuditService } from './finance-audit.service';
import { FinanceIdempotencyService } from './finance-idempotency.service';

/**
 * Cross-cutting finance helpers (audit log, idempotency keys). Marked @Global
 * so every finance module can inject without re-importing.
 */
@Global()
@Module({
  providers: [FinanceAuditService, FinanceIdempotencyService],
  exports: [FinanceAuditService, FinanceIdempotencyService],
})
export class FinanceCoreModule {}
