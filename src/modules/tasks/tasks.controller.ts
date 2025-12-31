import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { TasksService } from "./tasks.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { CreateTaskDto, UpdateTaskDto, QuickAddDto } from "./dto/tasks.dto";

@Controller("tasks")
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private tasksService: TasksService) {}

  @Post("quick-add")
  quickAdd(@CurrentUser("sub") userId: string, @Body() dto: QuickAddDto) {
    return this.tasksService.quickAdd(userId, dto);
  }

  @Post()
  create(@CurrentUser("sub") userId: string, @Body() dto: CreateTaskDto) {
    return this.tasksService.create(userId, dto);
  }

  @Get()
  findAll(@CurrentUser("sub") userId: string) {
    return this.tasksService.findAll(userId);
  }

  @Get("list/:listId")
  findByList(
    @CurrentUser("sub") userId: string,
    @Param("listId") listId: string,
  ) {
    return this.tasksService.findByList(userId, listId);
  }

  @Get("calendar")
  findByDateRange(
    @CurrentUser("sub") userId: string,
    @Query("start") start: string,
    @Query("end") end: string,
  ) {
    return this.tasksService.findByDateRange(
      userId,
      new Date(start),
      new Date(end),
    );
  }

  @Get("completed")
  findCompleted(@CurrentUser("sub") userId: string) {
    return this.tasksService.findCompleted(userId);
  }

  @Get("trash")
  findTrash(@CurrentUser("sub") userId: string) {
    return this.tasksService.findTrash(userId);
  }

  @Delete("trash/clear")
  clearTrash(@CurrentUser("sub") userId: string) {
    return this.tasksService.clearTrash(userId);
  }

  @Get(":id")
  findOne(@CurrentUser("sub") userId: string, @Param("id") id: string) {
    return this.tasksService.findOne(userId, id);
  }

  @Put(":id")
  update(
    @CurrentUser("sub") userId: string,
    @Param("id") id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(userId, id, dto);
  }

  @Post(":id/complete")
  complete(@CurrentUser("sub") userId: string, @Param("id") id: string) {
    return this.tasksService.complete(userId, id);
  }

  @Post(":id/uncomplete")
  uncomplete(@CurrentUser("sub") userId: string, @Param("id") id: string) {
    return this.tasksService.uncomplete(userId, id);
  }

  @Post(":id/restore")
  restore(@CurrentUser("sub") userId: string, @Param("id") id: string) {
    return this.tasksService.restore(userId, id);
  }

  @Delete(":id")
  delete(@CurrentUser("sub") userId: string, @Param("id") id: string) {
    return this.tasksService.delete(userId, id);
  }

  @Delete(":id/permanent")
  permanentDelete(@CurrentUser("sub") userId: string, @Param("id") id: string) {
    return this.tasksService.permanentDelete(userId, id);
  }

  @Put(":id/reorder")
  reorder(
    @CurrentUser("sub") userId: string,
    @Param("id") id: string,
    @Body("position") position: number,
  ) {
    return this.tasksService.reorder(userId, id, position);
  }

  @Put(":id/move")
  moveToList(
    @CurrentUser("sub") userId: string,
    @Param("id") id: string,
    @Body("listId") listId: string | null,
  ) {
    return this.tasksService.moveToList(userId, id, listId);
  }
}
