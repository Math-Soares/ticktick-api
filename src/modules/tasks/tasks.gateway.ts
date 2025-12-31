import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { JwtService } from "@nestjs/jwt";
import { Logger } from "@nestjs/common";

@WebSocketGateway({
  cors: {
    origin: "*",
  },
  namespace: "/tasks",
})
export class TasksGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger("TasksGateway");

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;
      if (!token) {
        this.logger.warn(`Client ${client.id} tried to connect without token`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const userId = payload.sub;

      // Join user's room
      client.join(`user:${userId}`);
      client.data.userId = userId;

      this.logger.log(`Client ${client.id} connected to user:${userId}`);
    } catch (error) {
      this.logger.error(`Client ${client.id} auth failed: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client ${client.id} disconnected`);
  }

  /**
   * Emit event to all devices of a specific user
   */
  emitTaskUpdate(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
    this.logger.debug(`Emitted ${event} to user:${userId}`);
  }
}
