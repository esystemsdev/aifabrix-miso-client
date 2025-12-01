/**
 * Express Response Type Extensions
 * Extends Express Response with standardized response helper methods
 */

import type { PaginationMeta } from "./response-helper";

declare global {
  namespace Express {
    interface Response {
      /**
       * Success response with data (200)
       * @param data - Response data
       * @param message - Optional success message
       */
      success: <T>(data: T, message?: string) => Response;

      /**
       * Created response (201)
       * @param data - Created resource data
       * @param message - Optional success message
       */
      created: <T>(data: T, message?: string) => Response;

      /**
       * Paginated list response (200)
       * @param items - Array of items
       * @param meta - Pagination metadata
       */
      paginated: <T>(items: T[], meta: PaginationMeta) => Response;

      /**
       * No content response (204)
       */
      noContent: () => Response;

      /**
       * Accepted response (202)
       * @param data - Optional data about the accepted request
       * @param message - Optional message
       */
      accepted: <T>(data?: T, message?: string) => Response;
    }
  }
}

export {};
