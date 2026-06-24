// src/common/middleware/request-context.middleware.ts
//
// Assigns/propagates a request id for every request (reuses an inbound X-Request-Id if
// present, else generates one), exposes it on the request + response header, so the error
// envelope and structured logs can be correlated end-to-end.

import { Injectable, NestMiddleware } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { NextFunction, Request, Response } from "express";

declare module "express" {
  interface Request {
    requestId?: string;
  }
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = (req.headers["x-request-id"] as string) || undefined;
    const id = incoming ?? randomUUID();
    req.requestId = id;
    res.setHeader("X-Request-Id", id);
    next();
  }
}
