// src/common/filters/all-exceptions.filter.ts
//
// Catches everything and emits the single error envelope
//   { error: { code, message, details, request_id } }
// • HttpException → its status + a derived code (+ class-validator details for 400s)
// • Prisma known errors → mapped to sane HTTP statuses (e.g. unique → 409, not found → 404)
// • anything else → 500 with a generic message (no internals leaked); full error is logged.

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Request, Response } from "express";
import { ErrorResponse } from "../interfaces/api-response.interface";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("Exception");

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const requestId = req.requestId ?? "unknown";

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = "INTERNAL_ERROR";
    let message = "An unexpected error occurred";
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      code = this.codeForStatus(status);
      if (typeof body === "string") {
        message = body;
      } else if (body && typeof body === "object") {
        const b = body as Record<string, unknown>;
        message =
          (Array.isArray(b.message)
            ? "Validation failed"
            : (b.message as string)) ?? message;
        if (Array.isArray(b.message)) details = b.message; // class-validator messages
        if (typeof b.code === "string") code = b.code; // allow domain codes
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      ({ status, code, message } = this.mapPrisma(exception));
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      code = "VALIDATION_ERROR";
      message = "Invalid query";
    }

    // Log 5xx with stack; 4xx at warn without noise.
    if (status >= 500) {
      this.logger.error(
        `[${requestId}] ${req.method} ${req.url} → ${status} ${code}`,
        (exception as Error)?.stack,
      );
    } else {
      this.logger.warn(
        `[${requestId}] ${req.method} ${req.url} → ${status} ${code}`,
      );
    }

    const payload: ErrorResponse = {
      error: { code, message, details, request_id: requestId },
    };
    res.status(status).json(payload);
  }

  private codeForStatus(status: number): string {
    const map: Record<number, string> = {
      400: "BAD_REQUEST",
      401: "UNAUTHORIZED",
      403: "FORBIDDEN",
      404: "NOT_FOUND",
      409: "CONFLICT",
      422: "UNPROCESSABLE_ENTITY",
      429: "RATE_LIMITED",
    };
    return map[status] ?? (status >= 500 ? "INTERNAL_ERROR" : "ERROR");
  }

  private mapPrisma(e: Prisma.PrismaClientKnownRequestError): {
    status: number;
    code: string;
    message: string;
  } {
    switch (e.code) {
      case "P2002": {
        const fields = e.meta?.target as string[] | string | undefined;
        const field = Array.isArray(fields) ? fields[0] : fields;
        const label =
          field === "email"
            ? "email address"
            : field === "phone"
              ? "phone number"
              : "value";
        return {
          status: HttpStatus.CONFLICT,
          code: "CONFLICT",
          message: `This ${label} is already registered`,
        };
      }
      case "P2025":
        return {
          status: HttpStatus.NOT_FOUND,
          code: "NOT_FOUND",
          message: "Resource not found",
        };
      case "P2003":
        return {
          status: HttpStatus.BAD_REQUEST,
          code: "FK_CONSTRAINT",
          message: "Related resource constraint failed",
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          code: "DB_ERROR",
          message: "Database error",
        };
    }
  }
}
