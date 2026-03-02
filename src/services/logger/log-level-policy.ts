import { LogLevel, LogEntry } from "../../types/config.types";

const LOG_LEVEL_PRIORITY: Record<LogEntry["level"], number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  audit: 100, // Audit logs are always preserved.
};

export function shouldLogLevel(
  configuredLevel: LogLevel | undefined,
  level: LogEntry["level"],
): boolean {
  if (level === "audit") {
    return true;
  }

  const threshold = configuredLevel || "info";
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[threshold];
}
