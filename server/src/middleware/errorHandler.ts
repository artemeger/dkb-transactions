/**
 * Custom error classes for consistent error handling.
 */

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.isOperational = true; // Errors that are expected in production
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource?: string) {
    super(`${resource || 'Resource'} not found`, 404);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Express middleware for centralized error handling.
 * Wraps route handlers to catch errors automatically and return consistent responses.
 */
export function errorHandler(err: Error, _req: unknown, res: { status: (code: number) => { json: (body: any) => void } }, _next: () => void): void {
  // Log error stack for debugging
  console.error(`[ERROR] ${err.name}:`, err.message);

  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message = err instanceof AppError ? err.message : 'Internal server error';

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

/**
 * Wrapper for Express route handlers that automatically catches async errors.
 * Usage: router.get('/path', asyncHandler(async (req, res) => { ... }))
 */
export function asyncHandler(
  fn: (req: any, res: any) => Promise<void>
): (req: any, res: any, next: (err?: Error) => void) => void {
  return (req, res, next) => {
    fn(req, res).catch(next);
  };
}
