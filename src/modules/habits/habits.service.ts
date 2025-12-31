import { Injectable, NotFoundException, Inject } from "@nestjs/common";
import { DRIZZLE } from "../../drizzle/drizzle.provider";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../drizzle/schema";
import { eq, and, isNull, gte, lte, desc, sql, sum, count } from "drizzle-orm";
import { CreateHabitDto, UpdateHabitDto, LogHabitDto } from "./dto/habits.dto";
import { startOfWeek, endOfWeek, subDays, format } from "date-fns";

@Injectable()
export class HabitsService {
  constructor(
    @Inject(DRIZZLE) private db: NodePgDatabase<typeof schema>,
  ) { }

  async create(userId: string, dto: CreateHabitDto) {
    const [habit] = await this.db
      .insert(schema.habits)
      .values({
        ...dto,
        userId,
      })
      .returning();
    return habit;
  }

  async findAll(userId: string) {
    const habits = await this.db.query.habits.findMany({
      where: and(
        eq(schema.habits.userId, userId),
        isNull(schema.habits.archivedAt),
      ),
      with: {
        logs: {
          where: (logs, { gte }) => gte(logs.date, subDays(new Date(), 30)),
          orderBy: (logs, { desc }) => [desc(logs.date)],
        },
      },
    });

    return habits;
  }

  async findOne(userId: string, habitId: string) {
    const habit = await this.db.query.habits.findFirst({
      where: and(
        eq(schema.habits.id, habitId),
        eq(schema.habits.userId, userId),
      ),
      with: {
        logs: {
          orderBy: (logs, { desc }) => [desc(logs.date)],
          limit: 90,
        },
      },
    });

    if (!habit) {
      throw new NotFoundException("Habit not found");
    }

    return habit;
  }

  async update(userId: string, habitId: string, dto: UpdateHabitDto) {
    await this.findOne(userId, habitId);

    const [updated] = await this.db
      .update(schema.habits)
      .set(dto)
      .where(eq(schema.habits.id, habitId))
      .returning();

    return updated;
  }

  async archive(userId: string, habitId: string) {
    await this.findOne(userId, habitId);

    const [updated] = await this.db
      .update(schema.habits)
      .set({ archivedAt: new Date() })
      .where(eq(schema.habits.id, habitId))
      .returning();

    return updated;
  }

  async delete(userId: string, habitId: string) {
    await this.findOne(userId, habitId);

    await this.db.delete(schema.habits).where(eq(schema.habits.id, habitId));

    return { success: true };
  }

  async logCompletion(userId: string, habitId: string, dto: LogHabitDto) {
    await this.findOne(userId, habitId);

    const dateStr = dto.date || format(new Date(), "yyyy-MM-dd");
    const dateOnly = new Date(`${dateStr}T00:00:00Z`);

    // Upsert the log
    const [log] = await this.db
      .insert(schema.habitLogs)
      .values({
        habitId,
        date: dateOnly,
        count: 1,
        notes: dto.notes,
      })
      .onConflictDoUpdate({
        target: [schema.habitLogs.habitId, schema.habitLogs.date],
        set: {
          count: sql`${schema.habitLogs.count} + 1`,
          notes: dto.notes,
        },
      })
      .returning();

    // Update streak
    await this.updateStreak(habitId);

    return log;
  }

  async removeLog(userId: string, habitId: string, date: string) {
    await this.findOne(userId, habitId);

    const dateOnly = new Date(`${date}T00:00:00Z`);

    await this.db
      .delete(schema.habitLogs)
      .where(
        and(
          eq(schema.habitLogs.habitId, habitId),
          eq(schema.habitLogs.date, dateOnly),
        ),
      );

    await this.updateStreak(habitId);

    return { success: true };
  }

  private async updateStreak(habitId: string) {
    const habit = await this.db.query.habits.findFirst({
      where: eq(schema.habits.id, habitId),
      with: {
        logs: {
          orderBy: (logs, { desc }) => [desc(logs.date)],
          limit: 365,
        },
      },
    });

    if (!habit) return;

    let streak = 0;
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const logDatesSorted = habit.logs
      .map((l) => l.date.toISOString().split("T")[0])
      .sort()
      .reverse(); // Newest first

    if (logDatesSorted.length === 0) {
      streak = 0;
    } else {
      const logDatesSet = new Set(logDatesSorted);
      const latestLogStr = logDatesSorted[0];
      const yesterdayStr = format(subDays(new Date(), 1), "yyyy-MM-dd");

      // If the latest log is older than yesterday, the streak is broken
      if (latestLogStr < yesterdayStr && latestLogStr !== todayStr) {
        streak = 0;
      } else {
        // Start checking from the most recent completed date found
        const [year, month, day] = latestLogStr.split("-").map(Number);
        const checkDate = new Date(Date.UTC(year, month - 1, day));
        let checkDateStr = latestLogStr;

        while (logDatesSet.has(checkDateStr)) {
          streak++;
          checkDate.setUTCDate(checkDate.getUTCDate() - 1);
          checkDateStr = checkDate.toISOString().split("T")[0];
        }
      }
    }

    // Update habit with new streak
    const updates: any = { currentStreak: streak };
    if (streak > habit.longestStreak) {
      updates.longestStreak = streak;
    }

    await this.db
      .update(schema.habits)
      .set(updates)
      .where(eq(schema.habits.id, habitId));
  }

  async getStats(userId: string, habitId: string) {
    const habit = await this.findOne(userId, habitId);

    const todayStr = format(new Date(), "yyyy-MM-dd");
    const todayUtc = new Date(`${todayStr}T00:00:00Z`);
    const thisWeekStart = startOfWeek(todayUtc, { weekStartsOn: 1 });
    const thisWeekEnd = endOfWeek(todayUtc, { weekStartsOn: 1 });

    const [thisWeekLogs] = await this.db
      .select({ value: count() })
      .from(schema.habitLogs)
      .where(
        and(
          eq(schema.habitLogs.habitId, habitId),
          gte(schema.habitLogs.date, thisWeekStart),
          lte(schema.habitLogs.date, thisWeekEnd),
        ),
      );

    const [totalCompletions] = await this.db
      .select({ value: sum(schema.habitLogs.count) })
      .from(schema.habitLogs)
      .where(eq(schema.habitLogs.habitId, habitId));

    return {
      currentStreak: habit.currentStreak,
      longestStreak: habit.longestStreak,
      thisWeekCompletions: thisWeekLogs?.value || 0,
      totalCompletions: Number(totalCompletions?.value) || 0,
    };
  }
}
