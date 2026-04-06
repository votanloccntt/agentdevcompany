import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private pubClient: RedisClientType;
  private subClient: RedisClientType;
  private isConnected = false;

  async onModuleInit() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    try {
      this.pubClient = createClient({ url: redisUrl });
      this.subClient = this.pubClient.duplicate();

      this.pubClient.on('error', (err) => {
        console.error('[Redis] Pub client error:', err);
        this.isConnected = false;
      });

      this.subClient.on('error', (err) => {
        console.error('[Redis] Sub client error:', err);
        this.isConnected = false;
      });

      await Promise.all([
        this.pubClient.connect(),
        this.subClient.connect(),
      ]);

      this.isConnected = true;
      console.log('[Redis] Connected successfully');
    } catch (err) {
      console.warn('[Redis] Connection failed, running without Redis:', err.message);
      this.isConnected = false;
    }
  }

  async onModuleDestroy() {
    if (this.pubClient) await this.pubClient.quit();
    if (this.subClient) await this.subClient.quit();
  }

  getAdapter() {
    if (!this.isConnected) {
      console.warn('[Redis] Redis not connected, using default adapter');
      return undefined;
    }
    return createAdapter(this.pubClient, this.subClient);
  }

  isAvailable(): boolean {
    return this.isConnected;
  }
}
