import { Request, Response, NextFunction } from "express";

/**
 * Request logging middleware for development
 * Logs incoming requests, responses, and timing
 */
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // Only log in development
  if (process.env.NODE_ENV !== "development") {
    return next();
  }

  const startTime = Date.now();
  const { method, url, body, query, params } = req;

  // Log incoming request
  console.log("\n" + "=".repeat(80));
  console.log(`📥 INCOMING REQUEST`);
  console.log("=".repeat(80));
  console.log(`⏰ Time: ${new Date().toLocaleString()}`);
  console.log(`🔹 Method: ${method}`);
  console.log(`🔹 URL: ${url}`);
  console.log(`🔹 User: ${(req as any).user?.email || "Not authenticated"}`);

  // Log query params if present
  if (Object.keys(query).length > 0) {
    console.log(`🔹 Query Params:`, JSON.stringify(query, null, 2));
  }

  // Log URL params if present
  if (Object.keys(params).length > 0) {
    console.log(`🔹 URL Params:`, JSON.stringify(params, null, 2));
  }

  // Log request body (excluding sensitive fields)
  if (body && Object.keys(body).length > 0) {
    const sanitizedBody = { ...body };
    if (sanitizedBody.password) sanitizedBody.password = "***HIDDEN***";
    console.log(`🔹 Body:`, JSON.stringify(sanitizedBody, null, 2));
  }

  // Capture the original res.json to log response
  const originalJson = res.json.bind(res);
  res.json = function (data: any) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    console.log("\n" + "-".repeat(80));
    console.log(`📤 OUTGOING RESPONSE`);
    console.log("-".repeat(80));
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(
      `🔹 Status: ${statusCode} ${statusCode >= 200 && statusCode < 300 ? "✅" : statusCode >= 400 ? "❌" : "⚠️"}`,
    );

    // Log response data (truncate if too large)
    const responseStr = JSON.stringify(data, null, 2);
    if (responseStr.length > 1000) {
      console.log(
        `🔹 Response: ${responseStr.substring(0, 1000)}... (truncated)`,
      );
    } else {
      console.log(`🔹 Response:`, responseStr);
    }
    console.log("=".repeat(80) + "\n");

    return originalJson(data);
  };

  next();
};

/**
 * Error logging middleware for development
 * Logs detailed error information
 */
export const errorLogger = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // Only log in development
  if (process.env.NODE_ENV !== "development") {
    return next(err);
  }

  console.log("\n" + "🔴".repeat(40));
  console.log(`❌ ERROR OCCURRED`);
  console.log("🔴".repeat(40));
  console.log(`⏰ Time: ${new Date().toLocaleString()}`);
  console.log(`🔹 Method: ${req.method}`);
  console.log(`🔹 URL: ${req.url}`);
  console.log(`🔹 Error Name: ${err.name}`);
  console.log(`🔹 Error Message: ${err.message}`);

  if (err.stack) {
    console.log(`🔹 Stack Trace:`);
    console.log(err.stack);
  }

  console.log("🔴".repeat(40) + "\n");

  next(err);
};
