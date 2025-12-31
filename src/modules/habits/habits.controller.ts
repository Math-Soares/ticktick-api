import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from "@nestjs/common";
import { HabitsService } from "./habits.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { CreateHabitDto, UpdateHabitDto, LogHabitDto } from "./dto/habits.dto";

@Controller("habits")
@UseGuards(JwtAuthGuard)
export class HabitsController {
  constructor(private habitsService: HabitsService) {}

  @Post()
  create(@CurrentUser("sub") userId: string, @Body() dto: CreateHabitDto) {
    return this.habitsService.create(userId, dto);
  }

  @Get()
  findAll(@CurrentUser("sub") userId: string) {
    return this.habitsService.findAll(userId);
  }

  @Get(":id")
  findOne(@CurrentUser("sub") userId: string, @Param("id") id: string) {
    return this.habitsService.findOne(userId, id);
  }

  @Get(":id/stats")
  getStats(@CurrentUser("sub") userId: string, @Param("id") id: string) {
    return this.habitsService.getStats(userId, id);
  }

  @Put(":id")
  update(
    @CurrentUser("sub") userId: string,
    @Param("id") id: string,
    @Body() dto: UpdateHabitDto,
  ) {
    return this.habitsService.update(userId, id, dto);
  }

  @Post(":id/archive")
  archive(@CurrentUser("sub") userId: string, @Param("id") id: string) {
    return this.habitsService.archive(userId, id);
  }

  @Delete(":id")
  delete(@CurrentUser("sub") userId: string, @Param("id") id: string) {
    return this.habitsService.delete(userId, id);
  }

  @Post(":id/log")
  logCompletion(
    @CurrentUser("sub") userId: string,
    @Param("id") id: string,
    @Body() dto: LogHabitDto,
  ) {
    return this.habitsService.logCompletion(userId, id, dto);
  }

  @Delete(":id/log/:date")
  removeLog(
    @CurrentUser("sub") userId: string,
    @Param("id") id: string,
    @Param("date") date: string,
  ) {
    return this.habitsService.removeLog(userId, id, date);
  }
}
