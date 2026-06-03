import { NestFactory } from "@nestjs/core"
import { ValidationPipe } from "@nestjs/common"
import { AppModule } from "./app.module"
import { ResponseInterceptor } from "./common/interceptors/response.interceptor"
import { HttpExceptionFilter } from "./common/filters/http-exception.filter"
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger"

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // Enable CORS
  const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:3000"
  app.enableCors({
    origin: [clientOrigin, "http://localhost:3001"],
    credentials: true,
  })

  app.setGlobalPrefix("api")

  // Swagger Documentation Setup
  const config = new DocumentBuilder()
    .setTitle("Verity API")
    .setDescription("The API specification for Verity prediction markets.")
    .setVersion("1.0")
    .addBearerAuth()
    .addTag("auth", "User authentication and session management")
    .addTag("users", "User profiles, wallet links, and daily usage stats")
    .addTag("posts", "Market creation and feed operations")
    .addTag("markets", "Prediction market trading, voting, and resolution")
    .addTag(
      "liquidity",
      "Liquidity pool funding, deposits, withdrawals, and states",
    )
    .build()
  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup("api/docs", app, document)

  // Global validation pipes to enforce DTO constraints
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )

  // Global exception filter and response serialization interceptor mapping
  app.useGlobalFilters(new HttpExceptionFilter())
  app.useGlobalInterceptors(new ResponseInterceptor())

  const port = Number(process.env.PORT || 5050)
  await app.listen(port)
  console.log(
    `Verity NestJS Backend is running on: http://localhost:${port}/api`,
  )
  console.log(
    `Swagger documentation is available at: http://localhost:${port}/api/docs`,
  )
}
bootstrap()
