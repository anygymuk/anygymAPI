import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class FormErrorFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let errorMessage: string;

    if (typeof exceptionResponse === 'string') {
      errorMessage = exceptionResponse;
    } else if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'error' in exceptionResponse &&
      typeof (exceptionResponse as { error: unknown }).error === 'string'
    ) {
      errorMessage = (exceptionResponse as { error: string }).error;
    } else if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'message' in exceptionResponse
    ) {
      const message = (exceptionResponse as { message: string | string[] }).message;
      errorMessage = Array.isArray(message) ? message[0] : message;
    } else {
      errorMessage =
        status >= HttpStatus.INTERNAL_SERVER_ERROR
          ? 'Something went wrong. Please try again or contact contact@any-gym.com'
          : 'Invalid request';
    }

    response.status(status).json({ error: errorMessage });
  }
}
