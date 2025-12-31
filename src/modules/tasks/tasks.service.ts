import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { TasksGateway } from "./tasks.gateway";
import { TaskParserService } from "./nlp/task-parser.service";
import { CreateTaskDto, UpdateTaskDto, QuickAddDto } from "./dto/tasks.dto";

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private tasksGateway: TasksGateway,
    private taskParser: TaskParserService,
  ) {}

  async quickAdd(userId: string, dto: QuickAddDto) {
    // Parse natural language input
    const parsed = this.taskParser.parse(dto.input);

    // Create task with parsed data
    const task = await this.prisma.task.create({
      data: {
        title: parsed.title,
        dueDate: parsed.dueDate,
        dueTime: parsed.dueTime,
        recurrenceRule: parsed.recurrenceRule,
        priority: parsed.priority,
        tags: parsed.tags.join(","),
        userId,
        listId: dto.listId,
      },
    });

    // Emit real-time update
    this.tasksGateway.emitTaskUpdate(userId, "task:created", task);

    return task;
  }

  async create(userId: string, dto: CreateTaskDto) {
    const task = await this.prisma.task.create({
      data: {
        ...dto,
        userId,
      },
    });

    this.tasksGateway.emitTaskUpdate(userId, "task:created", task);
    return task;
  }

  async findAll(userId: string) {
    return this.prisma.task.findMany({
      where: { userId, deletedAt: null },
      orderBy: [
        { completedAt: "asc" },
        { dueDate: "asc" },
        { position: "asc" },
      ],
      include: { list: true },
    });
  }

  async findByList(userId: string, listId: string) {
    return this.prisma.task.findMany({
      where: { userId, listId, deletedAt: null },
      orderBy: [{ completedAt: "asc" }, { position: "asc" }],
    });
  }

  async findCompleted(userId: string) {
    return this.prisma.task.findMany({
      where: {
        userId,
        deletedAt: null,
        completedAt: { not: null },
      },
      orderBy: { completedAt: "desc" },
      include: { list: true },
    });
  }

  async findTrash(userId: string) {
    return this.prisma.task.findMany({
      where: { userId, deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      include: { list: true },
    });
  }

  async findByDateRange(userId: string, start: Date, end: Date) {
    return this.prisma.task.findMany({
      where: {
        userId,
        deletedAt: null,
        dueDate: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { dueDate: "asc" },
      include: { list: true },
    });
  }

  async findOne(userId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, userId },
      include: { list: true },
    });

    if (!task) {
      throw new NotFoundException("Task not found");
    }

    return task;
  }

  async update(userId: string, taskId: string, dto: UpdateTaskDto) {
    await this.findOne(userId, taskId); // Ensure task exists

    const task = await this.prisma.task.update({
      where: { id: taskId },
      data: dto,
    });

    this.tasksGateway.emitTaskUpdate(userId, "task:updated", task);
    return task;
  }

  async complete(userId: string, taskId: string) {
    await this.findOne(userId, taskId);

    const task = await this.prisma.task.update({
      where: { id: taskId },
      data: { completedAt: new Date() },
    });

    this.tasksGateway.emitTaskUpdate(userId, "task:completed", task);
    return task;
  }

  async uncomplete(userId: string, taskId: string) {
    await this.findOne(userId, taskId);

    const task = await this.prisma.task.update({
      where: { id: taskId },
      data: { completedAt: null },
    });

    this.tasksGateway.emitTaskUpdate(userId, "task:updated", task);
    return task;
  }

  // Soft delete
  async delete(userId: string, taskId: string) {
    await this.findOne(userId, taskId);

    const task = await this.prisma.task.update({
      where: { id: taskId },
      data: { deletedAt: new Date() },
    });

    this.tasksGateway.emitTaskUpdate(userId, "task:deleted", { id: taskId });
    return { success: true };
  }

  async restore(userId: string, taskId: string) {
    await this.findOne(userId, taskId);

    const task = await this.prisma.task.update({
      where: { id: taskId },
      data: { deletedAt: null },
    });

    this.tasksGateway.emitTaskUpdate(userId, "task:created", task); // Re-emit as created for lists to pick up
    return task;
  }

  async permanentDelete(userId: string, taskId: string) {
    await this.findOne(userId, taskId);

    await this.prisma.task.delete({
      where: { id: taskId },
    });

    return { success: true };
  }

  async reorder(userId: string, taskId: string, newPosition: number) {
    await this.findOne(userId, taskId);

    const task = await this.prisma.task.update({
      where: { id: taskId },
      data: { position: newPosition },
    });

    this.tasksGateway.emitTaskUpdate(userId, "task:reordered", task);
    return task;
  }

  async moveToList(userId: string, taskId: string, listId: string | null) {
    await this.findOne(userId, taskId);

    const task = await this.prisma.task.update({
      where: { id: taskId },
      data: { listId },
    });

    this.tasksGateway.emitTaskUpdate(userId, "task:moved", task);
    return task;
  }

  async clearTrash(userId: string) {
    await this.prisma.task.deleteMany({
      where: { userId, deletedAt: { not: null } },
    });
    return { success: true };
  }
}
