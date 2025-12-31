import { Injectable, NotFoundException, Inject } from "@nestjs/common";
import { DRIZZLE } from "../../drizzle/drizzle.provider";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../drizzle/schema";
import { eq, and, isNull, isNotNull, asc, desc, gte, lte } from "drizzle-orm";
import { TasksGateway } from "./tasks.gateway";
import { TaskParserService } from "./nlp/task-parser.service";
import { CreateTaskDto, UpdateTaskDto, QuickAddDto } from "./dto/tasks.dto";

@Injectable()
export class TasksService {
  constructor(
    @Inject(DRIZZLE) private db: NodePgDatabase<typeof schema>,
    private tasksGateway: TasksGateway,
    private taskParser: TaskParserService,
  ) { }

  async quickAdd(userId: string, dto: QuickAddDto) {
    // Parse natural language input
    const parsed = this.taskParser.parse(dto.input);

    // Create task with parsed data
    const [task] = await this.db
      .insert(schema.tasks)
      .values({
        title: parsed.title,
        dueDate: parsed.dueDate,
        dueTime: parsed.dueTime,
        recurrenceRule: parsed.recurrenceRule,
        priority: parsed.priority,
        tags: parsed.tags.join(","),
        userId,
        listId: dto.listId,
      })
      .returning();

    // Emit real-time update
    this.tasksGateway.emitTaskUpdate(userId, "task:created", task);

    return task;
  }

  async create(userId: string, dto: CreateTaskDto) {
    const taskData: any = { ...dto };
    if (dto.dueDate) {
      taskData.dueDate = new Date(dto.dueDate);
    }

    const [task] = await this.db
      .insert(schema.tasks)
      .values({
        ...taskData,
        userId,
      })
      .returning();

    this.tasksGateway.emitTaskUpdate(userId, "task:created", task);
    return task;
  }

  async findAll(userId: string) {
    return this.db.query.tasks.findMany({
      where: and(
        eq(schema.tasks.userId, userId),
        isNull(schema.tasks.deletedAt),
      ),
      orderBy: [
        asc(schema.tasks.completedAt),
        asc(schema.tasks.dueDate),
        asc(schema.tasks.position),
      ],
      with: { list: true },
    });
  }

  async findByList(userId: string, listId: string) {
    return this.db.query.tasks.findMany({
      where: and(
        eq(schema.tasks.userId, userId),
        eq(schema.tasks.listId, listId),
        isNull(schema.tasks.deletedAt),
      ),
      orderBy: [asc(schema.tasks.completedAt), asc(schema.tasks.position)],
    });
  }

  async findCompleted(userId: string) {
    return this.db.query.tasks.findMany({
      where: and(
        eq(schema.tasks.userId, userId),
        isNull(schema.tasks.deletedAt),
        isNotNull(schema.tasks.completedAt),
      ),
      orderBy: [desc(schema.tasks.completedAt)],
      with: { list: true },
    });
  }

  async findTrash(userId: string) {
    return this.db.query.tasks.findMany({
      where: and(
        eq(schema.tasks.userId, userId),
        isNotNull(schema.tasks.deletedAt),
      ),
      orderBy: [desc(schema.tasks.deletedAt)],
      with: { list: true },
    });
  }

  async findByDateRange(userId: string, start: Date, end: Date) {
    return this.db.query.tasks.findMany({
      where: and(
        eq(schema.tasks.userId, userId),
        isNull(schema.tasks.deletedAt),
        gte(schema.tasks.dueDate, start),
        lte(schema.tasks.dueDate, end),
      ),
      orderBy: [asc(schema.tasks.dueDate)],
      with: { list: true },
    });
  }

  async findOne(userId: string, taskId: string) {
    const task = await this.db.query.tasks.findFirst({
      where: and(
        eq(schema.tasks.id, taskId),
        eq(schema.tasks.userId, userId),
      ),
      with: { list: true },
    });

    if (!task) {
      throw new NotFoundException("Task not found");
    }

    return task;
  }

  async update(userId: string, taskId: string, dto: UpdateTaskDto) {
    await this.findOne(userId, taskId); // Ensure task exists

    const updateData: any = { ...dto };
    if (dto.dueDate) {
      updateData.dueDate = new Date(dto.dueDate);
    }

    const [task] = await this.db
      .update(schema.tasks)
      .set(updateData)
      .where(eq(schema.tasks.id, taskId))
      .returning();

    this.tasksGateway.emitTaskUpdate(userId, "task:updated", task);
    return task;
  }

  async complete(userId: string, taskId: string) {
    await this.findOne(userId, taskId);

    const [task] = await this.db
      .update(schema.tasks)
      .set({ completedAt: new Date() })
      .where(eq(schema.tasks.id, taskId))
      .returning();

    this.tasksGateway.emitTaskUpdate(userId, "task:completed", task);
    return task;
  }

  async uncomplete(userId: string, taskId: string) {
    await this.findOne(userId, taskId);

    const [task] = await this.db
      .update(schema.tasks)
      .set({ completedAt: null })
      .where(eq(schema.tasks.id, taskId))
      .returning();

    this.tasksGateway.emitTaskUpdate(userId, "task:updated", task);
    return task;
  }

  // Soft delete
  async delete(userId: string, taskId: string) {
    await this.findOne(userId, taskId);

    await this.db
      .update(schema.tasks)
      .set({ deletedAt: new Date() })
      .where(eq(schema.tasks.id, taskId));

    this.tasksGateway.emitTaskUpdate(userId, "task:deleted", { id: taskId });
    return { success: true };
  }

  async restore(userId: string, taskId: string) {
    await this.findOne(userId, taskId);

    const [task] = await this.db
      .update(schema.tasks)
      .set({ deletedAt: null })
      .where(eq(schema.tasks.id, taskId))
      .returning();

    this.tasksGateway.emitTaskUpdate(userId, "task:created", task); // Re-emit as created for lists to pick up
    return task;
  }

  async permanentDelete(userId: string, taskId: string) {
    await this.findOne(userId, taskId);

    await this.db.delete(schema.tasks).where(eq(schema.tasks.id, taskId));

    return { success: true };
  }

  async reorder(userId: string, taskId: string, newPosition: number) {
    await this.findOne(userId, taskId);

    const [task] = await this.db
      .update(schema.tasks)
      .set({ position: newPosition })
      .where(eq(schema.tasks.id, taskId))
      .returning();

    this.tasksGateway.emitTaskUpdate(userId, "task:reordered", task);
    return task;
  }

  async moveToList(userId: string, taskId: string, listId: string | null) {
    await this.findOne(userId, taskId);

    const [task] = await this.db
      .update(schema.tasks)
      .set({ listId })
      .where(eq(schema.tasks.id, taskId))
      .returning();

    this.tasksGateway.emitTaskUpdate(userId, "task:moved", task);
    return task;
  }

  async clearTrash(userId: string) {
    await this.db.delete(schema.tasks).where(
      and(
        eq(schema.tasks.userId, userId),
        isNotNull(schema.tasks.deletedAt),
      ),
    );
    return { success: true };
  }
}
