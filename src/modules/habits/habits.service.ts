import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateHabitDto, UpdateHabitDto, LogHabitDto } from "./dto/habits.dto";
import { startOfWeek, endOfWeek, subDays, format } from "date-fns";

@Injectable()
export class HabitsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateHabitDto) {
    return this.prisma.habit.create({
      data: {
        ...dto,
        userId,
      },
    });
  }

  async findAll(userId: string) {
    const habits = await this.prisma.habit.findMany({
      where: { userId, archivedAt: null },
      include: {
        logs: {
          where: {
            date: {
              gte: subDays(new Date(), 30),
            },
          },
          orderBy: { date: "desc" },
        },
      },
    });

    return habits;
  }

  async findOne(userId: string, habitId: string) {
    const habit = await this.prisma.habit.findFirst({
      where: { id: habitId, userId },
      include: {
        logs: {
          orderBy: { date: "desc" },
          take: 90,
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

    return this.prisma.habit.update({
      where: { id: habitId },
      data: dto,
    });
  }

  async archive(userId: string, habitId: string) {
    await this.findOne(userId, habitId);

    return this.prisma.habit.update({
      where: { id: habitId },
      data: { archivedAt: new Date() },
    });
  }

  async delete(userId: string, habitId: string) {
    await this.findOne(userId, habitId);

    await this.prisma.habit.delete({
      where: { id: habitId },
    });

    return { success: true };
  }

  async logCompletion(userId: string, habitId: string, dto: LogHabitDto) {
    await this.findOne(userId, habitId);

    const dateStr = dto.date || format(new Date(), "yyyy-MM-dd");
    const dateOnly = new Date(`${dateStr}T00:00:00Z`);

    // Upsert the log
    const log = await this.prisma.habitLog.upsert({
      where: {
        habitId_date: {
          habitId,
          date: dateOnly,
        },
      },
      update: {
        count: { increment: 1 },
        notes: dto.notes,
      },
      create: {
        habitId,
        date: dateOnly,
        count: 1,
        notes: dto.notes,
      },
    });

    // Update streak
    await this.updateStreak(habitId);

    return log;
  }

  async removeLog(userId: string, habitId: string, date: string) {
    await this.findOne(userId, habitId);

    const dateOnly = new Date(`${date}T00:00:00Z`);

    await this.prisma.habitLog.deleteMany({
      where: {
        habitId,
        date: dateOnly,
      },
    });

    await this.updateStreak(habitId);

    return { success: true };
  }

  private async updateStreak(habitId: string) {
    const habit = await this.prisma.habit.findUnique({
      where: { id: habitId },
      include: {
        logs: {
          orderBy: { date: "desc" },
          take: 365,
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
        // Start checking from the most recent completed date found (could be in the future for testing)
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

    await this.prisma.habit.update({
      where: { id: habitId },
      data: updates,
    });
  }

  async getStats(userId: string, habitId: string) {
    const habit = await this.findOne(userId, habitId);

    const todayStr = format(new Date(), "yyyy-MM-dd");
    const todayUtc = new Date(`${todayStr}T00:00:00Z`);
    const thisWeekStart = startOfWeek(todayUtc, { weekStartsOn: 1 });
    const thisWeekEnd = endOfWeek(todayUtc, { weekStartsOn: 1 });

    const thisWeekLogs = await this.prisma.habitLog.count({
      where: {
        habitId,
        date: {
          gte: thisWeekStart,
          lte: thisWeekEnd,
        },
      },
    });

    const totalCompletions = await this.prisma.habitLog.aggregate({
      where: { habitId },
      _sum: { count: true },
    });

    return {
      currentStreak: habit.currentStreak,
      longestStreak: habit.longestStreak,
      thisWeekCompletions: thisWeekLogs,
      totalCompletions: totalCompletions._sum.count || 0,
    };
  }
}
