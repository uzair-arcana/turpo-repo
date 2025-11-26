// src/filters/rpc-to-http.filter.ts
import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';

@Catch()
export class RpcToHttpFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();

    // 1) If it's an actual RpcException instance (unlikely across processes,
    // but possible if thrown locally), unwrap it:
    if (exception instanceof RpcException) {
      const err = exception.getError();
      const status =
        (err && (err as any).status) || HttpStatus.INTERNAL_SERVER_ERROR;
      const message =
        (err && (err as any).message) || err || 'Internal server error';
      return res.status(status).json({ statusCode: status, message });
    }

    // 2) Handle errors from firstValueFrom - they often have error property
    if (typeof exception === 'object' && exception !== null) {
      const maybe = exception as any;

      // Handle RPC errors wrapped by firstValueFrom
      if (maybe.error) {
        const rpcError = maybe.error;
        const status = (rpcError.status || rpcError.statusCode) || HttpStatus.INTERNAL_SERVER_ERROR;
        const message = rpcError.message || 'Internal server error';
        return res.status(status).json({
          statusCode: status,
          message,
        });
      }

      // If the microservice returned a plain object (very common), e.g. { status: 401, message: '...' }
      if (maybe.status && maybe.message) {
        return res.status(maybe.status).json({
          statusCode: maybe.status,
          message: maybe.message,
        });
      }
      // Some transports return { message, statusCode } etc.
      if (maybe.statusCode && maybe.message) {
        return res.status(maybe.statusCode).json({
          statusCode: maybe.statusCode,
          message: maybe.message,
        });
      }
    }

    // 3) If it's an HttpException — keep Nest's shape
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      return res.status(status).json(payload);
    }

    // 4) Fallback → unknown error
    const status = HttpStatus.INTERNAL_SERVER_ERROR;
    return res.status(status).json({
      statusCode: status,
      message: 'Internal server error',
    });
  }
}
