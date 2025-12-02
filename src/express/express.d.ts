/**
 * Express Response Type Extensions
 * Extends Express Response with standardized response helper methods
 *
 * Note: PaginationMeta is inlined to avoid `import type` syntax which
 * causes Jest parsing issues in consuming projects (Jest tries to parse
 * .d.ts files as JavaScript in CommonJS mode).
 */

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
       * @param meta - Pagination metadata (currentPage, pageSize, totalItems, totalPages?, type)
       */
      paginated: <T>(
        items: T[],
        meta: {
          currentPage: number;
          pageSize: number;
          totalItems: number;
          totalPages?: number;
          type: string;
        },
      ) => Response;

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
