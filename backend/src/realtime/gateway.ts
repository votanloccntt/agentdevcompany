import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { RealTimeService } from './real-time.service';
import { RedisService } from './redis.service';

@WebSocketGateway({
  cors: {
    origin: '*', // Configure appropriately for production
    credentials: true,
  },
  namespace: '/ws',
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private realtimeService: RealTimeService,
    private redisService: RedisService,
  ) {}

  afterInit(server: Server) {
    console.log('[WebSocket Gateway] Initialized');
    
    // Set up Redis adapter if available
    const adapter = this.redisService.getAdapter();
    if (adapter) {
      server.adapter(adapter);
      console.log('[WebSocket Gateway] Redis adapter enabled');
    } else {
      console.log('[WebSocket Gateway] Running without Redis adapter');
    }

    // Initialize RealTimeService with server
    this.realtimeService.init(server);
  }

  handleConnection(client: Socket) {
    console.log(`[WebSocket] Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`[WebSocket] Client disconnected: ${client.id}`);
  }

  /**
   * Join a project room to receive project-specific events
   */
  @SubscribeMessage('join:project')
  handleJoinProject(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string },
  ) {
    const { projectId } = data;
    client.join(`project:${projectId}`);
    console.log(`[WebSocket] Client ${client.id} joined project:${projectId}`);
    return { success: true, room: `project:${projectId}` };
  }

  /**
   * Leave a project room
   */
  @SubscribeMessage('leave:project')
  handleLeaveProject(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string },
  ) {
    const { projectId } = data;
    client.leave(`project:${projectId}`);
    console.log(`[WebSocket] Client ${client.id} left project:${projectId}`);
    return { success: true };
  }

  /**
   * Join a task room to receive task-specific events
   */
  @SubscribeMessage('join:task')
  handleJoinTask(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { taskId: string },
  ) {
    const { taskId } = data;
    client.join(`task:${taskId}`);
    console.log(`[WebSocket] Client ${client.id} joined task:${taskId}`);
    return { success: true };
  }

  /**
   * Leave a task room
   */
  @SubscribeMessage('leave:task')
  handleLeaveTask(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { taskId: string },
  ) {
    const { taskId } = data;
    client.leave(`task:${taskId}`);
    return { success: true };
  }

  /**
   * Subscribe to analysis progress for a project
   */
  @SubscribeMessage('subscribe:analysis')
  handleSubscribeAnalysis(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string },
  ) {
    const { projectId } = data;
    client.join(`analysis:${projectId}`);
    console.log(`[WebSocket] Client ${client.id} subscribed to analysis:${projectId}`);
    return { success: true };
  }

  /**
   * Ping-pong for connection health check
   */
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    return { event: 'pong', timestamp: Date.now() };
  }
}
