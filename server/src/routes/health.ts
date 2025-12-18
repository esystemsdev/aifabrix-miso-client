/**
 * Health check route
 * Provides health check endpoint for monitoring
 */

import { Request, Response } from "express";

/**
 * Health check endpoint
 * Returns server status and uptime
 */
export function healthHandler(req: Request, res: Response): void {
  console.log(`[${new Date().toISOString()}] Health check called`);
  try {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
    console.log(`[${new Date().toISOString()}] Health check response sent`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Health check error:`, error);
    res.status(500).json({ error: "Health check failed" });
  }
}

