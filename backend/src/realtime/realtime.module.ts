import { Module, Global } from '@nestjs/common';
import { RealTimeService } from './real-time.service';
import { RedisService } from './redis.service';
import { RealtimeGateway } from './gateway';

@Global()
@Module({
  imports: [],
  controllers: [],
  providers: [RealTimeService, RedisService, RealtimeGateway],
  exports: [RealTimeService, RedisService],
})
export class RealTimeModule {}
