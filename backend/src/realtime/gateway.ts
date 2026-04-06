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
import { RealTimeService } from './real-time.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/ws',
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private realtimeService: RealTimeService) {}

  afterInit(server: Server) {
    console.log('[WebSocket Gateway] Server initialized');
    console.log('[WebSocket Gateway] Namespace: /ws');
    
    // Initialize RealTimeService with server
    this.realtimeService.init(server);
    console.log('[WebSocket Gateway] RealTimeService initialized');
  }

  handleConnection(client: Socket, ...args: any[]) {
    console.log('[WebSocket] Client connected: ' + client.id);
  }

  handleDisconnect(client: Socket) {
    console.log('[WebSocket] Client disconnected: ' + client.id);
  }

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

  @SubscribeMessage('leave:project')
  handleLeaveProject(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string },
  ) {
    const { projectId } = data;
    client.leave(`project:${projectId}`);
    return { success: true };
  }

  @SubscribeMessage('join:task')
  handleJoinTask(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { taskId: string },
  ) {
    const { taskId } = data;
    client.join(`task:${taskId}`);
    return { success: true };
  }

  @SubscribeMessage('leave:task')
  handleLeaveTask(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { taskId: string },
  ) {
    const { taskId } = data;
    client.leave(`task:${taskId}`);
    return { success: true };
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    return { event: 'pong', timestamp: Date.now() };
  }
}
