import { BootstrapError, BootstrapTokenProvider } from "./types";

/** Load only the official managed-identity credential, never a developer chain. */
export async function createIdentityProvider(): Promise<BootstrapTokenProvider> {
  try {
    const { ManagedIdentityCredential } = await import("@azure/identity");
    const credential = new ManagedIdentityCredential({
      clientId: process.env.AZURE_CLIENT_ID,
    });
    return {
      async getToken(scope, abortSignal) {
        const token = await credential.getToken(scope, { abortSignal });
        if (!token) throw new BootstrapError("identity-unavailable");
        return {
          token: token.token,
          expiresAt: new Date(token.expiresOnTimestamp),
        };
      },
    };
  } catch {
    throw new BootstrapError("identity-unavailable");
  }
}
