import { Injectable } from "@nestjs/common";
import * as chrono from "chrono-node";
import { RRule, Weekday } from "rrule";

export interface ParsedTask {
  title: string;
  dueDate: Date | null;
  dueTime: string | null;
  recurrenceRule: string | null;
  priority: number;
  tags: string[];
}

@Injectable()
export class TaskParserService {
  private weekdayMap: Record<string, Weekday> = {
    domingo: RRule.SU,
    segunda: RRule.MO,
    terça: RRule.TU,
    quarta: RRule.WE,
    quinta: RRule.TH,
    sexta: RRule.FR,
    sábado: RRule.SA,
    sunday: RRule.SU,
    monday: RRule.MO,
    tuesday: RRule.TU,
    wednesday: RRule.WE,
    thursday: RRule.TH,
    friday: RRule.FR,
    saturday: RRule.SA,
  };

  /**
   * Parses natural language input into structured task data
   * Examples:
   * - "Pagar conta amanhã 14h" -> dueDate: tomorrow 14:00
   * - "Estudar React a cada 5 do mês" -> recurrence: FREQ=MONTHLY;BYMONTHDAY=5
   * - "Reunião toda última sexta do mês" -> recurrence: FREQ=MONTHLY;BYDAY=FR;BYSETPOS=-1
   * - "Comprar leite #compras !!!" -> tags: ['compras'], priority: 3
   */
  parse(input: string): ParsedTask {
    const originalInput = input.trim();
    let text = input;
    const result: ParsedTask = {
      title: "",
      dueDate: null,
      dueTime: null,
      recurrenceRule: null,
      priority: 0,
      tags: [],
    };

    // 1. Extract priority (!, !!, !!!)
    const priorityMatch = text.match(/(!{1,3})(?:\s|$)/);
    if (priorityMatch) {
      result.priority = priorityMatch[1].length;
      text = text.replace(priorityMatch[0], " ");
    }

    // 2. Extract tags (#tag)
    const tagRegex = /#(\w+)/g;
    let tagMatch;
    while ((tagMatch = tagRegex.exec(text)) !== null) {
      result.tags.push(tagMatch[1]);
    }
    text = text.replace(/#\w+/g, "");

    // 3. Extract recurrence patterns
    const recurrenceResult = this.extractRecurrence(text);
    if (recurrenceResult.rule) {
      result.recurrenceRule = recurrenceResult.rule;
      text = recurrenceResult.cleanedText;
    }

    // 4. Extract Portuguese specific time formats (e.g., "19h", "14h30", "9h")
    const ptTimeResult = this.extractPortugueseTime(text);
    if (ptTimeResult) {
      result.dueTime = ptTimeResult.time;
      text = ptTimeResult.cleanedText;
    }

    // 5. Extract date/time with chrono-node (Portuguese)
    const parsed = chrono.pt.parse(text, new Date(), { forwardDate: true });
    if (parsed.length > 0) {
      const parsedDate = parsed[0];

      // Safeguard: If chrono wants to eat the entire remaining text as a date (e.g., "a2"),
      // and it doesn't look like a clear date expression (like "amanhã" or "20/12"),
      // we ignore it to keep it as a title.
      const isAbbreviatedTime = /^[aà]s?\s*\d+$/i.test(parsedDate.text.trim());
      const isJustDateText =
        parsedDate.text.trim().length === text.trim().length;

      if (!(isJustDateText && isAbbreviatedTime)) {
        result.dueDate = parsedDate.start.date();

        // Extract time if present (and not already found by PT parser)
        if (!result.dueTime && parsedDate.start.isCertain("hour")) {
          const hours = parsedDate.start
            .get("hour")
            ?.toString()
            .padStart(2, "0");
          const minutes = (parsedDate.start.get("minute") || 0)
            .toString()
            .padStart(2, "0");
          result.dueTime = `${hours}:${minutes}`;
        }

        // Remove date text from title
        text = text.replace(parsedDate.text, "");
      }
    }

    // 6. Clean up title
    result.title = text.replace(/\s+/g, " ").trim();

    // Final Safeguard: If title is empty but we had input, use the input as title
    if (!result.title && originalInput) {
      // Remove priority/tags from original input to get a cleaner fallback title
      result.title =
        originalInput
          .replace(/!{1,3}(?:\s|$)/g, "")
          .replace(/#\w+/g, "")
          .trim() || originalInput;
    }

    return result;
  }

  private extractPortugueseTime(
    text: string,
  ): { time: string; cleanedText: string } | null {
    // Formats: "19h", "19h30", "14:30h", "9h"
    // Also handles "às 19h", "as 19h"
    // Require a word boundary or space before the number to avoid matching "a1", "a2"
    const timeRegex =
      /(?:\bàs\s+|\bas\s+|\s+)(\d{1,2})(?:h|:)(\d{2})?h?(?:\b|$)/i;
    const match = text.match(timeRegex);

    if (match) {
      const hours = parseInt(match[1]);
      const minutes = match[2] ? parseInt(match[2]) : 0;

      if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
        const time = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
        const cleanedText = text
          .replace(match[0], " ")
          .replace(/\s+/g, " ")
          .trim();
        return { time, cleanedText };
      }
    }
    return null;
  }

  private extractRecurrence(text: string): {
    rule: string | null;
    cleanedText: string;
  } {
    let cleanedText = text;

    // Pattern: "a cada X do mês" or "todo dia X do mês"
    const monthlyDayMatch = text.match(
      /(?:a cada|todo dia)\s+(\d+)\s+do\s+mês/i,
    );
    if (monthlyDayMatch) {
      const rule = new RRule({
        freq: RRule.MONTHLY,
        bymonthday: parseInt(monthlyDayMatch[1]),
      });
      cleanedText = text.replace(monthlyDayMatch[0], "");
      return { rule: rule.toString(), cleanedText };
    }

    // Pattern: "toda última [weekday] do mês"
    const lastWeekdayMatch = text.match(
      /toda\s+última\s+(segunda|terça|quarta|quinta|sexta|sábado|domingo)(?:\s+do\s+mês)?/i,
    );
    if (lastWeekdayMatch) {
      const weekday = this.weekdayMap[lastWeekdayMatch[1].toLowerCase()];
      if (weekday) {
        const rule = new RRule({
          freq: RRule.MONTHLY,
          byweekday: weekday,
          bysetpos: -1,
        });
        cleanedText = text.replace(lastWeekdayMatch[0], "");
        return { rule: rule.toString(), cleanedText };
      }
    }

    // Pattern: "toda [weekday]" or "todas as [weekday]s"
    const weeklyMatch = text.match(
      /(?:toda|todas\s+as)\s+(segunda|terça|quarta|quinta|sexta|sábado|domingo)s?/i,
    );
    if (weeklyMatch) {
      const weekday = this.weekdayMap[weeklyMatch[1].toLowerCase()];
      if (weekday) {
        const rule = new RRule({
          freq: RRule.WEEKLY,
          byweekday: weekday,
        });
        cleanedText = text.replace(weeklyMatch[0], "");
        return { rule: rule.toString(), cleanedText };
      }
    }

    // Pattern: "todo dia" or "diariamente"
    const dailyMatch = text.match(/(?:todo\s+dia|diariamente)/i);
    if (dailyMatch) {
      const rule = new RRule({ freq: RRule.DAILY });
      cleanedText = text.replace(dailyMatch[0], "");
      return { rule: rule.toString(), cleanedText };
    }

    // Pattern: "toda semana" or "semanalmente"
    const weeklySimpleMatch = text.match(/(?:toda\s+semana|semanalmente)/i);
    if (weeklySimpleMatch) {
      const rule = new RRule({ freq: RRule.WEEKLY });
      cleanedText = text.replace(weeklySimpleMatch[0], "");
      return { rule: rule.toString(), cleanedText };
    }

    // Pattern: "todo mês" or "mensalmente"
    const monthlyMatch = text.match(/(?:todo\s+mês|mensalmente)/i);
    if (monthlyMatch) {
      const rule = new RRule({ freq: RRule.MONTHLY });
      cleanedText = text.replace(monthlyMatch[0], "");
      return { rule: rule.toString(), cleanedText };
    }

    return { rule: null, cleanedText };
  }
}
