export type SessionRecoveryTrigger =
  | "activity"
  | "visibilitychange"
  | "online"
  | "manual";

export type SessionRecoveryTelemetryReason =
  | "cooldown"
  | "dedupe"
  | "inflight"
  | "success"
  | "failure";

export interface SessionRecoveryTelemetryEvent {
  reason: SessionRecoveryTelemetryReason;
  trigger: SessionRecoveryTrigger;
  timestampMs: number;
  detail?: string;
}

export interface SessionRecoveryOrchestratorOptions {
  cooldownMs: number;
  postRecoveryDedupeMs: number;
  executeRecovery: (trigger: SessionRecoveryTrigger) => Promise<boolean>;
  now?: () => number;
  onTelemetry?: (event: SessionRecoveryTelemetryEvent) => void;
}

function isNonManualTrigger(trigger: SessionRecoveryTrigger): boolean {
  return trigger !== "manual";
}

function createTelemetryEmitter(
  now: () => number,
  onTelemetry?: (event: SessionRecoveryTelemetryEvent) => void,
): (
  reason: SessionRecoveryTelemetryReason,
  trigger: SessionRecoveryTrigger,
  detail?: string,
) => void {
  return (reason, trigger, detail) => {
    onTelemetry?.({
      reason,
      trigger,
      timestampMs: now(),
      detail,
    });
  };
}

export interface SessionRecoveryOrchestrator {
  triggerRecovery: (trigger: SessionRecoveryTrigger) => Promise<boolean>;
}

interface RecoveryRuntimeState {
  lastNonManualRecoveryAt: number;
  lastRecoveryCompletedAt: number;
  recoveryInFlight: Promise<boolean> | null;
}

function createRuntimeState(): RecoveryRuntimeState {
  return {
    lastNonManualRecoveryAt: 0,
    lastRecoveryCompletedAt: 0,
    recoveryInFlight: null,
  };
}

function shouldSuppressTrigger(
  trigger: SessionRecoveryTrigger,
  state: RecoveryRuntimeState,
  options: SessionRecoveryOrchestratorOptions,
  now: () => number,
  emitTelemetry: (
    reason: SessionRecoveryTelemetryReason,
    trigger: SessionRecoveryTrigger,
    detail?: string,
  ) => void,
): boolean {
  if (!isNonManualTrigger(trigger)) {
    return false;
  }

  const nowMs = now();
  if (nowMs - state.lastRecoveryCompletedAt < options.postRecoveryDedupeMs) {
    emitTelemetry("dedupe", trigger);
    return true;
  }

  if (
    state.lastNonManualRecoveryAt > 0 &&
    nowMs - state.lastNonManualRecoveryAt < options.cooldownMs
  ) {
    emitTelemetry("cooldown", trigger);
    return true;
  }

  return false;
}

function updateSuccessfulRecoveryMarkers(
  trigger: SessionRecoveryTrigger,
  state: RecoveryRuntimeState,
  now: () => number,
): void {
  const completedAt = now();
  state.lastRecoveryCompletedAt = completedAt;
  if (isNonManualTrigger(trigger)) {
    state.lastNonManualRecoveryAt = completedAt;
  }
}

async function executeRecoveryWithTracking(
  trigger: SessionRecoveryTrigger,
  state: RecoveryRuntimeState,
  options: SessionRecoveryOrchestratorOptions,
  now: () => number,
  emitTelemetry: (
    reason: SessionRecoveryTelemetryReason,
    trigger: SessionRecoveryTrigger,
    detail?: string,
  ) => void,
): Promise<boolean> {
  try {
    const attempted = await options.executeRecovery(trigger);
    if (!attempted) {
      emitTelemetry("failure", trigger, "not-attempted");
      return false;
    }

    updateSuccessfulRecoveryMarkers(trigger, state, now);
    emitTelemetry("success", trigger);
    return true;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    emitTelemetry("failure", trigger, detail);
    return false;
  }
}

export function createSessionRecoveryOrchestrator(
  options: SessionRecoveryOrchestratorOptions,
): SessionRecoveryOrchestrator {
  const now = options.now ?? (() => Date.now());
  const emitTelemetry = createTelemetryEmitter(now, options.onTelemetry);
  const state = createRuntimeState();

  return {
    async triggerRecovery(trigger: SessionRecoveryTrigger): Promise<boolean> {
      if (shouldSuppressTrigger(trigger, state, options, now, emitTelemetry)) {
        return false;
      }

      if (state.recoveryInFlight) {
        emitTelemetry("inflight", trigger);
        return false;
      }

      state.recoveryInFlight = executeRecoveryWithTracking(
        trigger,
        state,
        options,
        now,
        emitTelemetry,
      ).finally(() => {
        state.recoveryInFlight = null;
      });
      return state.recoveryInFlight;
    },
  };
}
