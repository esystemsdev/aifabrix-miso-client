/**
 * Event Emission Mode Example
 * 
 * Demonstrates how to use the SDK in event emission mode when embedding the SDK directly in your own application.
 * When emitEvents = true, logs are emitted as Node.js events instead of being sent via HTTP.
 * 
 * The unified logging interface works seamlessly with event emission mode - logs are still emitted
 * as events, but you use the simplified API with automatic context extraction.
 */

// For development: import from '../src/index'
import { MisoClient, loadConfig, LogEntry, getLogger, setLoggerContext } from '@aifabrix/miso-client';

async function eventEmissionExample() {
  // Create client with emitEvents enabled
  // This mode is designed for direct SDK embedding in your own application
  const client = new MisoClient({
    ...loadConfig(),
    emitEvents: true // Enable event emission mode
  });

  try {
    await client.initialize();

    // Set logger context (for non-Express environments)
    setLoggerContext({
      userId: 'user-123',
      correlationId: 'req-456',
    });

    // Get logger instance - context is automatically extracted
    const logger = getLogger();

    // Listen to log events
    client.log.on('log', (logEntry: LogEntry) => {
      console.log('📊 Log event received:', {
        level: logEntry.level,
        message: logEntry.message,
        userId: logEntry.userId,
        timestamp: logEntry.timestamp
      });
      
      // Save directly to database without HTTP
      // In your own application, you would save to DB here
      // await db.logs.insert(logEntry);
    });

    // Listen to batch events (for audit logs with batching)
    client.log.on('log:batch', (logEntries: LogEntry[]) => {
      console.log(`📊 Batch event received: ${logEntries.length} logs`);
      
      // Save batch directly to database without HTTP
      // In your own application, you would batch insert here
      // await db.logs.insertMany(logEntries);
    });

    // Use unified logging interface - events will be emitted instead of HTTP calls
    // Context is automatically extracted from AsyncLocalStorage
    await logger.info('Application started');
    await logger.error('Error occurred', new Error('test error'));
    await logger.audit('user.created', 'users', 'user-123');

    console.log('✅ Events emitted successfully');

  } catch (error) {
    console.error('❌ Event emission error:', error);
  } finally {
    await client.disconnect();
  }
}

/**
 * Complete setup example for direct SDK embedding
 * Shows how to set up event listeners and save logs directly to database
 */
async function directEmbeddingSetupExample() {
  const client = new MisoClient({
    ...loadConfig(),
    emitEvents: true,
    audit: {
      batchSize: 10,
      batchInterval: 100
    }
  });

  await client.initialize();

  // Single log event handler
  client.log.on('log', async (logEntry: LogEntry) => {
    try {
      // Save to database directly
      // Replace with your actual database implementation
      console.log('Saving log to DB:', {
        timestamp: logEntry.timestamp,
        level: logEntry.level,
        message: logEntry.message,
        userId: logEntry.userId
      });
      
      // Example DB save (pseudo-code):
      // await db.logs.insert({
      //   timestamp: logEntry.timestamp,
      //   level: logEntry.level,
      //   message: logEntry.message,
      //   context: logEntry.context,
      //   userId: logEntry.userId,
      //   correlationId: logEntry.correlationId,
      //   requestId: logEntry.requestId,
      //   sessionId: logEntry.sessionId
      // });
    } catch (error) {
      console.error('Failed to save log:', error);
    }
  });

  // Batch event handler (for audit logs with batching)
  client.log.on('log:batch', async (logEntries: LogEntry[]) => {
    try {
      // Batch insert to database
      console.log(`Saving ${logEntries.length} logs to DB in batch`);
      
      // Example DB batch save (pseudo-code):
      // await db.logs.insertMany(
      //   logEntries.map(entry => ({
      //     timestamp: entry.timestamp,
      //     level: entry.level,
      //     message: entry.message,
      //     context: entry.context,
      //     userId: entry.userId,
      //     correlationId: entry.correlationId,
      //     requestId: entry.requestId,
      //     sessionId: entry.sessionId
      //   }))
      // );
    } catch (error) {
      console.error('Failed to save batch logs:', error);
    }
  });

  // Set logger context
  setLoggerContext({
    userId: 'user-123',
    correlationId: 'req-456',
  });

  // Get logger instance - context is automatically extracted
  const logger = getLogger();

  // Use unified logging interface - events will be emitted
  await logger.info('Application started');
  await logger.error('Operation failed', new Error('details'));
}

export { eventEmissionExample, directEmbeddingSetupExample };

