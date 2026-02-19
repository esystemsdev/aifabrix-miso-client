/**
 * HTTP logging utilities for LoggerService
 * Extracted to keep logger.service.ts under max-lines limit
 */

import { LogEntry } from "../../types/config.types";
import type { ApiClient } from "../../api";

export function isAuthError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.message.includes("401") || error.message.includes("Unauthorized")) return true;
  return (error as { statusCode?: number }).statusCode === 401;
}

export async function sendAuditLogPayload(
  apiClient: ApiClient,
  logEntry: LogEntry,
  enrichedContext: Record<string, unknown>,
  logType: "audit" | "error" | "general",
  logLevel: "info" | "warn" | "error" | "debug",
): Promise<void> {
  const auditResource = enrichedContext.resource as string | undefined;
  const providedOldValues = enrichedContext.oldValues as Record<string, unknown> | undefined;
  const providedNewValues = enrichedContext.newValues as Record<string, unknown> | undefined;
  const entityType = (enrichedContext.entityType as string) ||
    (auditResource?.startsWith("/api/") ? "API Endpoint" : "HTTP Request");
  const entityId = (enrichedContext.entityId as string) || auditResource || "unknown";
  const action = (enrichedContext.action as string) || "unknown";

  delete enrichedContext.action;
  delete enrichedContext.resource;
  delete enrichedContext.entityType;
  delete enrichedContext.entityId;
  delete enrichedContext.oldValues;
  delete enrichedContext.newValues;

  await apiClient.logs.createLog({
    type: logType,
    data: {
      level: logLevel,
      message: logEntry.message,
      context: enrichedContext,
      correlationId: logEntry.correlationId,
      entityType,
      entityId,
      action,
      oldValues: providedOldValues,
      newValues: providedNewValues,
    },
  });
}
