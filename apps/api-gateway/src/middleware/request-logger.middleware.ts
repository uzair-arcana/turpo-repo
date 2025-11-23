import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MyLoggerService } from '../my-logger/my-logger.service';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  constructor(private readonly myLogger: MyLoggerService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const { method, originalUrl, ip } = req;

    res.on('finish', () => {
      const duration = Date.now() - start;
      const { statusCode } = res;
      const contentLength = res.get('content-length');

      // Console output
      const consoleMessage = `${method} ${originalUrl} ${statusCode} ${duration}ms`;

      // File output
      const fileMessage = `HTTP ${method} ${originalUrl} ${statusCode} ${duration}ms ${ip} ${
        contentLength || 0
      }b`;

      // Log to console
      if (statusCode >= 400) {
        this.myLogger.error(consoleMessage, 'HTTP');
      } else {
        this.myLogger.log(consoleMessage, 'HTTP');
      }

      // IMPORTANT: Directly call logToFile
      this.myLogger.logToFile(fileMessage).catch((error) => {
        console.error('logToFile failed:', error);
      });
    });

    next();
  }
}
