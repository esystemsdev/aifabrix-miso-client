import {
  asyncHandler,
  createSuccessResponse,
  type ApiResponse,
} from "@aifabrix/miso-client";
import type { NextFunction, Request, RequestHandler, Response } from "express";

const handler: RequestHandler = asyncHandler(
  async (
    _request: Request,
    response: Response,
    _next: NextFunction,
  ): Promise<void> => {
    response.status(200).json(createSuccessResponse({ compatible: true }));
  },
  "packedConsumer",
);

const response: ApiResponse<{ compatible: boolean }> = createSuccessResponse({
  compatible: true,
});

void handler;
void response;
