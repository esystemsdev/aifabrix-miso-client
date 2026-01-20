/**
 * Encryption-specific error class
 * Extends MisoClientError with encryption error codes
 */

import { MisoClientError } from './errors';

/**
 * Error codes for encryption operations
 */
export type EncryptionErrorCode =
  | 'ENCRYPTION_FAILED'
  | 'DECRYPTION_FAILED'
  | 'INVALID_PARAMETER_NAME'
  | 'ACCESS_DENIED'
  | 'PARAMETER_NOT_FOUND';

/**
 * Encryption error class with error code and parameter name
 */
export class EncryptionError extends MisoClientError {
  public readonly code: EncryptionErrorCode;
  public readonly parameterName: string;

  /**
   * Create encryption error
   * @param message - Error message
   * @param code - Error code for programmatic handling
   * @param parameterName - The parameter name that caused the error
   */
  constructor(
    message: string,
    code: EncryptionErrorCode,
    parameterName: string,
  ) {
    super(message);
    this.name = 'EncryptionError';
    this.code = code;
    this.parameterName = parameterName;

    // Maintain proper stack trace for V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, EncryptionError);
    }
  }
}
