import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";
import { TasksGateway } from "./tasks.gateway";
import { TaskParserService } from "./nlp/task-parser.service";

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get("JWT_SECRET"),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [TasksController],
  providers: [TasksService, TasksGateway, TaskParserService],
  exports: [TasksService, TasksGateway],
})
export class TasksModule {}
