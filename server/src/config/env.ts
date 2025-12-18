/**
 * Environment configuration loader
 * Provides environment variable loading with defaults and validation
 */

/**
 * Load and validate environment variables
 * @returns Configuration object with environment variables
 */
export function loadEnvConfig(): {
  port: number;
  nodeEnv: string;
  misoControllerUrl: string;
  misoClientId: string;
  misoClientSecret: string;
  misoAllowedOrigins: string[];
  misoLogLevel: string;
} {
  const port = parseInt(process.env.PORT || '3083', 10);
  const nodeEnv = process.env.NODE_ENV || 'development';
  const misoControllerUrl = process.env.MISO_CONTROLLER_URL || '';
  const misoClientId = process.env.MISO_CLIENTID || '';
  const misoClientSecret = process.env.MISO_CLIENTSECRET || '';
  const misoLogLevel = process.env.MISO_LOG_LEVEL || 'info';

  // Parse allowed origins
  const allowedOriginsStr = process.env.MISO_ALLOWED_ORIGINS || '';
  const misoAllowedOrigins = allowedOriginsStr
    ? allowedOriginsStr
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    : ['http://localhost:3083'];

  // Validate required variables in production
  if (nodeEnv === 'production') {
    if (!misoControllerUrl) {
      throw new Error('MISO_CONTROLLER_URL is required in production');
    }
    if (!misoClientId) {
      throw new Error('MISO_CLIENTID is required in production');
    }
    if (!misoClientSecret) {
      throw new Error('MISO_CLIENTSECRET is required in production');
    }
  }

  return {
    port,
    nodeEnv,
    misoControllerUrl,
    misoClientId,
    misoClientSecret,
    misoAllowedOrigins,
    misoLogLevel,
  };
}
