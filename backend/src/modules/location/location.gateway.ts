// src/modules/location/location.gateway.ts
//
// Socket.IO gateway for live tracking (namespace /location). Technicians stream location:update
// events; customers/admins subscribe to a booking's tracking room to receive live position,
// status, and arrival/working/completed events. JWT-authenticated on connect (same scheme as
// chat). Broadcast helpers are also called from LocationService so REST and socket paths emit
// identically (forwardRef breaks the service↔gateway cycle).
//
// SCALING: with multiple instances, use the Socket.IO Redis adapter (see chat.module notes) so
// room emits span nodes, and move TrackingService state to Redis.

import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from "@nestjs/websockets";
import { Inject, Logger, forwardRef } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Server, Socket } from "socket.io";
import { UserRole } from "@prisma/client";
import { AuthenticatedUser } from "../auth/interfaces/auth.interfaces";
import { LocationService } from "./location.service";
import {
  LOCATION_NAMESPACE,
  LocationEvent,
  roomForBooking,
  roomForTechnician,
} from "./enums";
import { UpdateLocationDto } from "./dto";

@WebSocketGateway({
  namespace: LOCATION_NAMESPACE,
  cors: { origin: true, credentials: true },
})
export class LocationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(LocationGateway.name);

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    @Inject(forwardRef(() => LocationService))
    private readonly location: LocationService,
  ) {}

  handleConnection(client: Socket) {
    try {
      client.data.user = this.authenticate(client);
      this.logger.log(`Location socket connected: user ${client.data.user.id}`);
    } catch (err) {
      client.emit(LocationEvent.ERROR, {
        code: "UNAUTHORIZED",
        message: "Authentication failed",
      });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const user = client.data.user as AuthenticatedUser | undefined;
    if (user) this.logger.log(`Location socket disconnected: user ${user.id}`);
  }

  // Customer/admin subscribes to a booking's live tracking.
  @SubscribeMessage("subscribeBooking")
  async subscribeBooking(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { bookingId: string },
  ) {
    const user = this.user(client);
    await this.location.getEta(user, body.bookingId).catch(() => undefined); // authorizes (throws if not permitted)
    await client.join(roomForBooking(body.bookingId));
    return { subscribed: body.bookingId };
  }

  @SubscribeMessage("unsubscribeBooking")
  async unsubscribeBooking(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { bookingId: string },
  ) {
    await client.leave(roomForBooking(body.bookingId));
    return { unsubscribed: body.bookingId };
  }

  // Technician streams a location fix over the socket (same path as POST /location/update).
  @SubscribeMessage(LocationEvent.LOCATION_UPDATE)
  async onLocationUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: UpdateLocationDto,
  ) {
    const user = this.user(client);
    return this.location.updateLocation(user, body); // service persists + broadcasts
  }

  // ---- broadcast helpers (called by LocationService) ----
  broadcastLocation(
    technicianId: string,
    bookingId: string | null,
    position: {
      latitude: number;
      longitude: number;
      accuracy?: number;
      recordedAt: Date;
    },
  ) {
    const payload = { technicianId, bookingId, ...position };
    this.server
      .to(roomForTechnician(technicianId))
      .emit(LocationEvent.LOCATION_UPDATE, payload);
    if (bookingId)
      this.server
        .to(roomForBooking(bookingId))
        .emit(LocationEvent.LOCATION_UPDATE, payload);
  }

  broadcastToBooking(
    bookingId: string,
    event: string,
    payload: Record<string, unknown>,
  ) {
    this.server.to(roomForBooking(bookingId)).emit(event, payload);
  }

  broadcastStatus(
    technicianId: string,
    event: string,
    payload: Record<string, unknown>,
  ) {
    this.server
      .to(roomForTechnician(technicianId))
      .emit(event, { technicianId, ...payload });
  }

  // ---- helpers ----
  private authenticate(client: Socket): AuthenticatedUser {
    const raw =
      (client.handshake.auth?.token as string | undefined) ??
      (client.handshake.headers?.authorization as string | undefined)?.replace(
        /^Bearer\s+/i,
        "",
      ) ??
      (client.handshake.query?.token as string | undefined);
    if (!raw) throw new WsException("Missing token");
    const payload = this.jwt.verify(raw, {
      secret: this.config.get<string>("jwt.accessSecret"),
    });
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role as UserRole,
      adminRole: payload.adminRole ?? null,
      permissions: payload.permissions ?? [],
    };
  }

  private user(client: Socket): AuthenticatedUser {
    const user = client.data.user as AuthenticatedUser | undefined;
    if (!user) throw new WsException("Unauthenticated socket");
    return user;
  }
}
