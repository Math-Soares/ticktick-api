import { Injectable, NotFoundException, Inject } from "@nestjs/common";
import { DRIZZLE } from "../../drizzle/drizzle.provider";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../drizzle/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { CreateListDto, UpdateListDto } from "./dto/lists.dto";

@Injectable()
export class ListsService {
  constructor(@Inject(DRIZZLE) private db: NodePgDatabase<typeof schema>) { }

  async create(userId: string, dto: CreateListDto) {
    const lastList = await this.db.query.lists.findFirst({
      where: eq(schema.lists.userId, userId),
      orderBy: [desc(schema.lists.position)],
    });

    const [list] = await this.db
      .insert(schema.lists)
      .values({
        ...dto,
        userId,
        position: (lastList?.position ?? 0) + 1,
      })
      .returning();

    return list;
  }

  async findAll(userId: string) {
    const lists = await this.db.query.lists.findMany({
      where: eq(schema.lists.userId, userId),
      orderBy: [asc(schema.lists.position)],
      extras: {
        taskCount:
          sql<number>`(SELECT count(*) FROM "Task" WHERE "Task"."listId" = "List"."id" AND "Task"."deletedAt" IS NULL AND "Task"."completedAt" IS NULL)`.as(
            "task_count",
          ),
      },
    });

    // Remap taskCount to _count matching Prisma response structure if frontend expects it
    return lists.map((list: any) => ({
      ...list,
      _count: {
        tasks: Number(list.taskCount),
      },
    }));
  }

  async findOne(userId: string, listId: string) {
    const list = await this.db.query.lists.findFirst({
      where: and(eq(schema.lists.id, listId), eq(schema.lists.userId, userId)),
    });

    if (!list) {
      throw new NotFoundException("List not found");
    }

    return list;
  }

  async update(userId: string, listId: string, dto: UpdateListDto) {
    await this.findOne(userId, listId);

    const [updated] = await this.db
      .update(schema.lists)
      .set(dto)
      .where(eq(schema.lists.id, listId))
      .returning();

    return updated;
  }

  async delete(userId: string, listId: string) {
    await this.findOne(userId, listId);

    await this.db.transaction(async (tx) => {
      // Soft-delete all tasks in this list
      await tx
        .update(schema.tasks)
        .set({
          deletedAt: new Date(),
          listId: null, // Move to Inbox so they aren't orphaned
        })
        .where(
          and(
            eq(schema.tasks.listId, listId),
            eq(schema.tasks.userId, userId),
          ),
        );

      // Permanently delete the list
      await tx.delete(schema.lists).where(eq(schema.lists.id, listId));
    });

    return { success: true };
  }

  async reorder(userId: string, listId: string, newPosition: number) {
    await this.findOne(userId, listId);

    const [updated] = await this.db
      .update(schema.lists)
      .set({ position: newPosition })
      .where(eq(schema.lists.id, listId))
      .returning();

    return updated;
  }
}
