import { Module, Global } from '@nestjs/common';
import { RealTimeService } from './real-time.service';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [RealTimeService, RedisService],
  exports: [RealTimeService, RedisService],
})
export class RealTimeModule {}
