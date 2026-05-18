import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS matching the previous Express configurations
  app.enableCors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:3000",
    credentials: true,
  });

  // Replicate prefix route namespace mapping
  app.setGlobalPrefix("api");

  // Global validation pipes to enforce DTO constraints
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global exception filter and response serialization interceptor mapping
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  const port = Number(process.env.PORT || 5000);
  await app.listen(port);
  console.log(`Verity NestJS Backend is running on: http://localhost:${port}/api`);
}
bootstrap();

