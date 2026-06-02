import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common"
import { Response } from "express"

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let message = "Internal server error."
    let errors: any = undefined

    if (exception instanceof HttpException) {
      status = exception.getStatus()
      const resContent: any = exception.getResponse()

      if (typeof resContent === "object") {
        // Handle validation errors from ValidationPipe
        if (
          status === HttpStatus.BAD_REQUEST &&
          Array.isArray(resContent.message)
        ) {
          status = HttpStatus.UNPROCESSABLE_ENTITY // 422 mapping
          message = "Validation failed."
          errors = resContent.message.map((msg: string) => {
            return {
              type: "field",
              msg,
              path: msg.split(" ")[0]?.toLowerCase() || "field",
              location: "body",
            }
          })
        } else {
          message = resContent.message || exception.message
        }
      } else {
        message = resContent || exception.message
      }
    } else if (exception instanceof Error) {
      const code = (exception as any).statusCode || (exception as any).status
      if (typeof code === "number") {
        status = code
        message = exception.message
      } else {
        message = exception.message
      }
    }

    const payload: any = {
      success: false,
      message,
    }

    if (errors) {
      payload.errors = errors
    }

    if (status >= 500) {
      this.logger.error(
        `${status} ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      )
    }

    response.status(status).json(payload)
  }
}
