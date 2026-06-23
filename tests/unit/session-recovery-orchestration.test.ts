import {
  createSessionRecoveryOrchestrator,
  SessionRecoveryTelemetryEvent,
} from "../../src/utils/session-recovery-orchestration";

describe("session-recovery-orchestration", () => {
  it("applies immediate-first then cooldown for non-manual triggers", async () => {
    let nowMs = 1_000_000;
    const recoveryCalls: string[] = [];

    const orchestrator = createSessionRecoveryOrchestrator({
      cooldownMs: 60_000,
      postRecoveryDedupeMs: 1_500,
      now: () => nowMs,
      executeRecovery: async (trigger) => {
        recoveryCalls.push(trigger);
        return true;
      },
    });

    expect(await orchestrator.triggerRecovery("activity")).toBe(true);
    expect(recoveryCalls).toEqual(["activity"]);

    nowMs += 59_000;
    expect(await orchestrator.triggerRecovery("activity")).toBe(false);
    expect(recoveryCalls).toEqual(["activity"]);

    nowMs += 1_000;
    expect(await orchestrator.triggerRecovery("activity")).toBe(true);
    expect(recoveryCalls).toEqual(["activity", "activity"]);
  });

  it("suppresses burst triggers in post-recovery dedupe window", async () => {
    let nowMs = 5_000_000;
    const telemetry: SessionRecoveryTelemetryEvent[] = [];

    const orchestrator = createSessionRecoveryOrchestrator({
      cooldownMs: 60_000,
      postRecoveryDedupeMs: 1_500,
      now: () => nowMs,
      onTelemetry: (event) => telemetry.push(event),
      executeRecovery: async () => true,
    });

    expect(await orchestrator.triggerRecovery("online")).toBe(true);
    nowMs += 100;
    expect(await orchestrator.triggerRecovery("visibilitychange")).toBe(false);

    expect(telemetry.some((event) => event.reason === "dedupe")).toBe(true);
  });

  it("reports inflight and runs a single recovery for concurrent triggers", async () => {
    const telemetry: SessionRecoveryTelemetryEvent[] = [];
    let completeRecovery!: () => void;
    const recoverySpy = jest.fn(
      async () =>
        await new Promise<boolean>((resolve) => {
          completeRecovery = () => resolve(true);
        }),
    );

    const orchestrator = createSessionRecoveryOrchestrator({
      cooldownMs: 60_000,
      postRecoveryDedupeMs: 1_500,
      executeRecovery: recoverySpy,
      onTelemetry: (event) => telemetry.push(event),
    });

    const first = orchestrator.triggerRecovery("manual");
    const second = orchestrator.triggerRecovery("manual");

    expect(await second).toBe(false);
    expect(recoverySpy).toHaveBeenCalledTimes(1);
    expect(telemetry.some((event) => event.reason === "inflight")).toBe(true);

    completeRecovery();
    expect(await first).toBe(true);
  });
});
