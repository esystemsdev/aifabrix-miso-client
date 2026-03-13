import { LogEntry } from "../../types/config.types";
import { ApplicationContextService } from "../application-context.service";
import { LoggerContextStorage } from "./logger-context-storage";
import {
  extractEnvironmentMetadata,
  extractJwtContext,
} from "./logger-context";
import { pickFirstNonEmpty } from "./trace-field-utils";

export interface BuildLogEntryParams {
  level: LogEntry["level"];
  message: string;
  maskedContext: Record<string, unknown> | undefined;
  stackTrace: string | undefined;
  options:
    | {
        sourceId?: string;
        sourceDisplayName?: string;
        externalSystemId?: string;
        externalSystemDisplayName?: string;
        recordId?: string;
        recordDisplayName?: string;
        credentialId?: string;
        credentialType?: string;
        responseSize?: number;
        durationMs?: number;
        errorCategory?: string;
        httpStatusCategory?: string;
      }
    | undefined;
  jwtContext: ReturnType<typeof extractJwtContext>;
  metadata: ReturnType<typeof extractEnvironmentMetadata>;
  appContext: ReturnType<ApplicationContextService["getApplicationContext"]>;
  loggerContext: ReturnType<LoggerContextStorage["getContext"]> | null;
  correlationId: string;
  clientId: string;
}

export function resolveCorrelationId(
  context: Record<string, unknown> | undefined,
  loggerCorrelationId: string | undefined,
  generateCorrelationId: () => string,
): string {
  return (
    pickFirstNonEmpty(context?.correlationId, loggerCorrelationId) ||
    generateCorrelationId()
  );
}

function resolvePrimaryTraceFields(params: BuildLogEntryParams): {
  environment: string;
  application: string;
  applicationId: string;
  requestId?: string;
  userId?: string;
  sessionId?: string;
} {
  const environment =
    pickFirstNonEmpty(
      params.maskedContext?.environment,
      params.appContext.environment,
      "unknown",
    ) || "unknown";
  const application =
    pickFirstNonEmpty(
      params.maskedContext?.application,
      params.appContext.application,
      params.clientId,
    ) || params.clientId;
  const requestId = pickFirstNonEmpty(
    params.maskedContext?.requestId,
    params.loggerContext?.requestId,
  );
  const userId = pickFirstNonEmpty(
    params.maskedContext?.userId,
    params.loggerContext?.userId,
    params.jwtContext.userId,
  );
  const sessionId = pickFirstNonEmpty(
    params.maskedContext?.sessionId,
    params.loggerContext?.sessionId,
    params.jwtContext.sessionId,
  );
  const applicationId =
    pickFirstNonEmpty(
      params.maskedContext?.applicationId,
      params.loggerContext?.applicationId,
      params.appContext.applicationId,
      params.jwtContext.applicationId,
    ) || "";

  return {
    environment,
    application,
    applicationId,
    requestId,
    userId,
    sessionId,
  };
}

export function buildLogEntryFromParams(params: BuildLogEntryParams): LogEntry {
  const primaryTraceFields = resolvePrimaryTraceFields(params);

  return {
    timestamp: new Date().toISOString(),
    level: params.level,
    environment: primaryTraceFields.environment,
    application: primaryTraceFields.application,
    applicationId: primaryTraceFields.applicationId,
    message: params.message,
    context: params.maskedContext,
    stackTrace: params.stackTrace,
    correlationId: params.correlationId,
    userId: primaryTraceFields.userId,
    sessionId: primaryTraceFields.sessionId,
    requestId: primaryTraceFields.requestId,
    ipAddress: params.loggerContext?.ipAddress || params.metadata.ipAddress,
    userAgent: params.loggerContext?.userAgent || params.metadata.userAgent,
    referer: params.loggerContext?.referer,
    ...params.metadata,
    sourceId: params.options?.sourceId,
    sourceDisplayName: params.options?.sourceDisplayName,
    externalSystemId: params.options?.externalSystemId,
    externalSystemDisplayName: params.options?.externalSystemDisplayName,
    recordId: params.options?.recordId,
    recordDisplayName: params.options?.recordDisplayName,
    credentialId: params.options?.credentialId,
    credentialType: params.options?.credentialType,
    requestSize: params.loggerContext?.requestSize,
    responseSize: params.options?.responseSize,
    durationMs: params.options?.durationMs,
    errorCategory: params.options?.errorCategory,
    httpStatusCategory: params.options?.httpStatusCategory,
  };
}

function createBaseEnrichedContext(
  logEntry: LogEntry,
  rawContext: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...rawContext,
    userId: logEntry.userId,
    sessionId: logEntry.sessionId,
    requestId: logEntry.requestId,
    ipAddress: logEntry.ipAddress,
    userAgent: logEntry.userAgent,
    referer: logEntry.referer,
    hostname: logEntry.hostname,
    applicationId: logEntry.applicationId,
    sourceId: logEntry.sourceId,
    sourceDisplayName: logEntry.sourceDisplayName,
    externalSystemId: logEntry.externalSystemId,
    externalSystemDisplayName: logEntry.externalSystemDisplayName,
    recordId: logEntry.recordId,
    recordDisplayName: logEntry.recordDisplayName,
    credentialId: logEntry.credentialId,
    credentialType: logEntry.credentialType,
    requestSize: logEntry.requestSize,
    responseSize: logEntry.responseSize,
    durationMs: logEntry.durationMs,
    errorCategory: logEntry.errorCategory,
    httpStatusCategory: logEntry.httpStatusCategory,
  };
}

function applyTraceOverrides(
  logEntry: LogEntry,
  rawContext: Record<string, unknown>,
  enrichedContext: Record<string, unknown>,
): void {
  const contextApplicationId = pickFirstNonEmpty(rawContext.applicationId);
  const resolvedApplicationId =
    pickFirstNonEmpty(logEntry.applicationId, contextApplicationId) ||
    logEntry.applicationId;
  if (resolvedApplicationId !== undefined) {
    enrichedContext.applicationId = resolvedApplicationId;
  }

  const resolvedUserId = pickFirstNonEmpty(logEntry.userId, rawContext.userId);
  if (resolvedUserId) {
    enrichedContext.userId = resolvedUserId;
  }

  const resolvedRequestId = pickFirstNonEmpty(
    logEntry.requestId,
    rawContext.requestId,
  );
  if (resolvedRequestId) {
    enrichedContext.requestId = resolvedRequestId;
  }

  const resolvedCorrelationId = pickFirstNonEmpty(
    logEntry.correlationId,
    rawContext.correlationId,
  );
  if (resolvedCorrelationId) {
    enrichedContext.correlationId = resolvedCorrelationId;
  }

  const resolvedApplication = pickFirstNonEmpty(
    logEntry.application,
    rawContext.application,
  );
  if (resolvedApplication) {
    enrichedContext.application = resolvedApplication;
  }

  const resolvedEnvironment = pickFirstNonEmpty(
    logEntry.environment,
    rawContext.environment,
  );
  if (resolvedEnvironment) {
    enrichedContext.environment = resolvedEnvironment;
  }
}

function removeUndefinedFields(context: Record<string, unknown>): void {
  Object.keys(context).forEach((key) => {
    if (context[key] === undefined) {
      delete context[key];
    }
  });
}

export function buildEnrichedLogContext(logEntry: LogEntry): Record<string, unknown> {
  const rawContext = logEntry.context || {};
  const enrichedContext = createBaseEnrichedContext(logEntry, rawContext);
  applyTraceOverrides(logEntry, rawContext, enrichedContext);
  removeUndefinedFields(enrichedContext);

  if (logEntry.stackTrace) {
    enrichedContext.stackTrace = logEntry.stackTrace;
  }

  return enrichedContext;
}
