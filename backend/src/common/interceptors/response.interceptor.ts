import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse();

    return next.handle().pipe(
      map((data) => {
        // If response is already fully wrapped, return as is
        if (data && typeof data === "object" && "success" in data) {
          return data;
        }

        const statusCode = response.statusCode;
        const message = statusCode === 201 ? "Created." : "OK";

        return {
          success: true,
          message,
          data,
        };
      }),
    );
  }
}
