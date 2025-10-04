import { Request, Response, NextFunction } from 'express';

interface LoggerRequest extends Request {}
interface LoggerResponse extends Response {}
interface LoggerNextFunction extends NextFunction {}

export function logger(
  req: LoggerRequest,
  res: LoggerResponse,
  next: LoggerNextFunction,
): void {
  console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
}
