import type { DataClientConfig } from "../../src/types/data-client.types";

const baseConfig = {
  baseUrl: "https://api.example.com",
  misoConfig: {
    controllerUrl: "https://controller.example.com",
    clientId: "client",
  },
};

const replacementConfig: DataClientConfig = {
  ...baseConfig,
  browserSession: {
    restore: async () => ({
      ok: true as const,
      auth: { kind: "cookie" as const },
    }),
  },
};

void replacementConfig;

const removedConfig: DataClientConfig = {
  ...baseConfig,
  // @ts-expect-error The semver-major lifecycle contract removed this field.
  onTokenRefresh: async () => null,
};

void removedConfig;
