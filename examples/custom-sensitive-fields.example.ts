/**
 * Example: Custom Sensitive Fields Configuration
 * 
 * This example shows how to use a custom sensitive fields configuration file
 * to extend the default ISO 27001 compliant sensitive fields.
 */

// For development: import from '../src/index'
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

async function example() {
  // Option 1: Use environment variable
  // Set MISO_SENSITIVE_FIELDS_CONFIG=/path/to/custom-sensitive-fields.json in .env
  process.env.MISO_SENSITIVE_FIELDS_CONFIG = './custom-sensitive-fields.json';
  
  // Option 2: Pass in config directly
  const config = {
    ...loadConfig(),
    sensitiveFieldsConfig: './custom-sensitive-fields.json' // Path to your custom config
  };
  
  const client = new MisoClient(config);
  await client.initialize();
  
  // Now all HTTP requests will use your custom sensitive fields configuration
  // for masking sensitive data in audit and debug logs
  
  const token = 'your-jwt-token-here';
  
  // This request will be automatically audited and debug logged (if logLevel === 'debug')
  // All sensitive data will be masked using your custom configuration
  const user = await client.getUser(token);
  
  console.log('User:', user);
  
  await client.disconnect();
}

/**
 * Custom Sensitive Fields Configuration File Structure
 * 
 * Create a JSON file with the following structure:
 * 
 * {
 *   "version": "1.0.0",
 *   "description": "Your custom sensitive fields configuration",
 *   "categories": {
 *     "authentication": [
 *       "password",
 *       "token",
 *       // ... add your custom authentication fields
 *     ],
 *     "pii": [
 *       "email",
 *       "ssn",
 *       // ... add your custom PII fields
 *     ],
 *     "financial": [
 *       "creditCard",
 *       // ... add your custom financial fields
 *     ],
 *     "security": [
 *       "privateKey",
 *       // ... add your custom security fields
 *     ]
 *   },
 *   "fieldPatterns": [
 *     "password",
 *     "secret",
 *     // ... add patterns that match sensitive fields
 *   ]
 * }
 * 
 * Note: Your custom fields will be merged with the default fields.
 * This means you can extend the default configuration without losing
 * the built-in ISO 27001 compliant fields.
 */

export { example };

