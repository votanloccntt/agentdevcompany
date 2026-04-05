import { Module, Global } from '@nestjs/common';
import { ExecutionStateService } from './execution-state.service';

@Global()
@Module({
  providers: [ExecutionStateService],
  exports: [ExecutionStateService],
})
export class ExecutionStateModule {}
