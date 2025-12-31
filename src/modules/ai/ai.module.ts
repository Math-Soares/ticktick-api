import { Module } from "@nestjs/common";
import { AiService } from "./ai.service";
import { AiController } from "./ai.controller";
import { TasksModule } from "../tasks/tasks.module";
import { ListsModule } from "../lists/lists.module";
import { HabitsModule } from "../habits/habits.module";

@Module({
  imports: [TasksModule, ListsModule, HabitsModule],
  providers: [AiService],
  controllers: [AiController],
  exports: [AiService],
})
export class AiModule {}
