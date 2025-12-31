import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { TasksService } from "../tasks/tasks.service";
import { ListsService } from "../lists/lists.service";
import { HabitsService } from "../habits/habits.service";
import { ChatDto } from "./dto/ai.dto";

@Injectable()
export class AiService {
  private openai: OpenAI;
  private readonly logger = new Logger(AiService.name);
  private readonly model: string;

  constructor(
    private configService: ConfigService,
    private tasksService: TasksService,
    private listsService: ListsService,
    private habitsService: HabitsService,
  ) {
    const apiKey = this.configService.get<string>("GROQ_API_KEY");
    this.model = this.configService.get<string>(
      "AI_MODEL",
      "openai/gpt-oss-120b",
    );

    this.openai = new OpenAI({
      apiKey: apiKey || "dummy-key",
      baseURL: "https://api.groq.com/openai/v1",
    });
  }

  async chat(userId: string, dto: ChatDto) {
    const { message, history = [] } = dto;

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: `You are an expert productivity assistant for a task management app (similar to TickTick). 
                
                CRITICAL RULES:
                1. To create, update, or get ANY data, you MUST use the provided tools. 
                2. Do NOT say you have done something (like created a task) unless you have CALLED the corresponding tool and received a success response.
                3. You already have the user's context. Do NOT ask for a userId or user identification.
                4. All tool calls automatically use the current logged-in user (ID: ${userId}). 
                5. If you need to reorganize an agenda, first call 'get_user_tasks' to see the current state.
                6. SCOPE RESTRICTION: You answer ONLY questions related to this task management application (creating tasks, organizing lists, productivity habits, etc.). If the user asks about unrelated topics (like writing Python code, general world knowledge, or other assistants), you must politely decline and explain that your purpose is solely to assist with this application.
                7. NEVER show the Task ID to the user. Use the ID internally for tool calls, but refer to tasks only by their title/date in your response.
                
                Capabilities:
                - Create tasks with 'create_task'. Use 'YYYY-MM-DD' for dueDate.
                - Reschedule or modify with 'update_task'.
                - Get context with 'get_user_tasks' and 'get_lists'.
                
                Current time: ${new Date().toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short" })}.
                Respond in Portuguese (default) or the user's language.`,
      },
      ...history.map((msg) => ({
        role: msg.role as "user" | "assistant" | "system",
        content: msg.content,
      })),
      { role: "user", content: message },
    ];

    try {
      this.logger.debug(`Sending request to Groq with model: ${this.model}`);

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages,
        tools: this.getTools(),
        tool_choice: "auto",
      });

      let responseMessage = response.choices[0].message;
      let loopCount = 0;
      const MAX_LOOPS = 5;

      // Keep track of the conversation flow within this request
      const currentMessages = [...messages];

      while (
        responseMessage.tool_calls &&
        responseMessage.tool_calls.length > 0 &&
        loopCount < MAX_LOOPS
      ) {
        loopCount++;

        // Add the assistant's request (with tool_calls) to history
        currentMessages.push(responseMessage);

        for (const toolCall of responseMessage.tool_calls) {
          if (toolCall.type !== "function") continue;
          const functionName = toolCall.function.name;
          let functionArgs = {};

          try {
            functionArgs = JSON.parse(toolCall.function.arguments);
          } catch (e) {
            this.logger.error(
              `[AI] Failed to parse args for ${functionName}: ${toolCall.function.arguments}`,
            );
          }

          let toolResult;
          try {
            toolResult = await this.handleToolCall(
              userId,
              functionName,
              functionArgs,
            );
          } catch (error) {
            this.logger.error(
              `[AI] Tool ERROR: ${functionName} - ${error.message}`,
            );
            toolResult = { error: error.message };
          }

          currentMessages.push({
            tool_call_id: toolCall.id,
            role: "tool",
            content: JSON.stringify(toolResult),
          });
        }

        const nextResponse = await this.openai.chat.completions.create({
          model: this.model,
          messages: currentMessages,
          tools: this.getTools(),
          tool_choice: "auto",
        });

        responseMessage = nextResponse.choices[0].message;
      }

      if (loopCount >= MAX_LOOPS) {
        this.logger.warn(
          `[AI] Max loops reached (${MAX_LOOPS}). Returning last response.`,
        );
      }

      return responseMessage;
    } catch (error) {
      const errorData = error.response?.data || error.message;
      this.logger.error(`Groq API Error Detail: ${JSON.stringify(errorData)}`);
      if (errorData?.failed_generation) {
        this.logger.error(`Failed Generation: ${errorData.failed_generation}`);
      }
      throw error;
    }
  }

  async generateDailyBriefing(userId: string) {
    // 1. Fetch relevant data
    const allTasks = await this.tasksService.findAll(userId);
    const allHabits = await this.habitsService.findAll(userId);

    // 2. Filter for Today + Overdue
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    const relevantTasks = allTasks.filter((task) => {
      // @ts-ignore
      if (task.completedAt) return false;
      if (!task.dueDate) return false;
      const taskDate = new Date(task.dueDate).toISOString().split("T")[0];
      return taskDate <= todayStr; // Today or Overdue
    });

    const relevantHabits = allHabits;

    // 3. Construct Prompt
    const tasksContext = relevantTasks
      .map(
        (t) =>
          // @ts-ignore
          `- [${t.priority === 3 ? "!!!" : t.priority === 2 ? "!!" : "!"}] ${t.title} (Due: ${new Date(t.dueDate as Date).toLocaleDateString()}, List: ${t.list?.name || "Inbox"})`,
      )
      .join("\n");

    const habitsContext = relevantHabits
      .map(
        (h) =>
          // @ts-ignore
          `- ${h.name} (Streak: ${h.currentStreak} 🔥, Goal: ${(h as any).dailyGoal || "1x"})`,
      )
      .join("\n");

    const systemPrompt = `
      Você é um coach de produtividade de elite, uma mistura de David Allen com Steve Jobs.
      Contexto do Usuário:
      - Nome: Usuário (Pode chamar de 'Campeão' ou sem nome)
      - Hora Atual: ${today.toLocaleTimeString("pt-BR")}
      
      Seu Objetivo:
      Criar um "Daily Briefing" (Resumo Diário) que seja:
      1. Conciso (max 3 parágrafos curtos).
      2. Motivacional mas realista.
      3. Estratégico (Identifique a "Única Coisa" que devem fazer).
      
      Dados:
      [TAREFAS PARA HOJE/ATRASADAS]
      ${tasksContext || "Sem tarefas urgentes! 🎉"}
      
      [HÁBITOS PARA MANTER]
      ${habitsContext || "Sem hábitos ativos."}
      
      Formate sua resposta em Markdown elegante. Use negrito para ênfase.
      NÃO use H1 (#). Comece com H2 (##) ou H3 (###).
      Se houver tarefas atrasadas, dê uma bronca leve mas encoraje a ação.
      Responda SEMPRE em PORTUGUÊS (Brasil).
      Termine com uma frase de impacto curta.
    `;

    // 4. Call Model
    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: "system", content: systemPrompt }],
        max_tokens: 1500,
      });

      return {
        briefing: response.choices[0].message.content,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error("Failed to generate briefing", error);
      return {
        briefing: "### System Offline \n\nI'm having trouble connecting to your neural link right now. Focus on your top priority task manually!",
        timestamp: new Date().toISOString()
      }
    }
  }

  private getTools(): OpenAI.Chat.Completions.ChatCompletionTool[] {
    return [
      {
        type: "function",
        function: {
          name: "get_user_tasks",
          description: "Get all active tasks for the user.",
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          name: "get_lists",
          description: "Get all user task lists.",
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          name: "create_task",
          description: "Create a new task.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string", description: "Task title" },
              description: { type: "string", description: "Description" },
              dueDate: { type: "string", description: "YYYY-MM-DD" },
              dueTime: { type: "string", description: "HH:mm" },
              priority: {
                type: "number",
                description: "0=None, 1=Low, 2=Medium, 3=High",
              },
              listId: { type: "string", description: "List ID" },
            },
            required: ["title"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "update_task",
          description: "Update a task.",
          parameters: {
            type: "object",
            properties: {
              taskId: { type: "string", description: "Task ID" },
              title: { type: "string" },
              description: { type: "string" },
              dueDate: { type: "string", description: "YYYY-MM-DD" },
              dueTime: { type: "string", description: "HH:mm" },
              priority: { type: "number" },
              completed: { type: "boolean" },
            },
            required: ["taskId"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "get_habits",
          description: "Get user habits.",
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          name: "create_habit",
          description: "Create a new habit.",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "Habit name" },
              description: { type: "string", description: "Description" },
              frequency: {
                type: "string",
                enum: ["DAILY", "WEEKLY", "MONTHLY"],
                description: "Frequency",
              },
              targetDays: {
                type: "array",
                items: { type: "integer" },
                description:
                  "For weekly: [0-6] (0=Sun). For monthly: [1-31].",
              },
              targetCount: {
                type: "number",
                description: "Target count per day (default 1)",
              },
            },
            required: ["name"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "create_list",
          description: "Create a new task list.",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "List name" },
              color: { type: "string", description: "Color (hex or name)" },
              icon: { type: "string", description: "Icon name" },
            },
            required: ["name"],
          },
        },
      },
    ];
  }

  // No stateful maps needed anymore. AI explicitly handles IDs.

  private async handleToolCall(
    userId: string,
    functionName: string,
    args: any,
  ) {
    switch (functionName) {
      case "get_user_tasks": {
        const tasks = await this.tasksService.findAll(userId);
        return this.sanitizeTasks(tasks);
      }
      case "get_lists": {
        const lists = await this.listsService.findAll(userId);
        return this.sanitizeLists(lists);
      }
      case "create_task":
        this.normalizeDate(args);
        const created = await this.tasksService.create(userId, args);
        return { success: true, title: created.title, message: "Tarefa criada com sucesso!", id: created.id };
      case "update_task": {
        const { taskId, ...updateData } = args;

        if (!taskId) {
          throw new Error("Task ID is required for updates.");
        }

        this.normalizeDate(updateData);

        if (updateData.completed !== undefined) {
          if (updateData.completed) await this.tasksService.complete(userId, taskId);
          else await this.tasksService.uncomplete(userId, taskId);
          delete updateData.completed;
        }

        if (Object.keys(updateData).length > 0) {
          await this.tasksService.update(userId, taskId, updateData);
        }
        return { success: true, message: "Tarefa atualizada com sucesso!" };
      }
      case "get_habits": {
        const habits = await this.habitsService.findAll(userId);
        return this.sanitizeHabits(habits);
      }
      case "create_habit": {
        // Normalize targetDays to string if it comes as array
        if (args.targetDays && Array.isArray(args.targetDays)) {
          args.targetDays = JSON.stringify(args.targetDays);
        }
        const created = await this.habitsService.create(userId, args);
        return {
          success: true,
          name: created.name,
          message: "Hábito criado com sucesso!",
          id: created.id,
        };
      }
      case "create_list": {
        const created = await this.listsService.create(userId, args);
        return {
          success: true,
          name: created.name,
          message: "Lista criada com sucesso!",
          id: created.id,
        };
      }
      default:
        throw new Error(`Tool ${functionName} not found`);
    }
  }

  /**
   * Remove apenas informações técnicas irrelevantes, MANTENDO o ID para uso da IA.
   */
  private sanitizeTasks(tasks: any[]): any[] {
    return tasks.map((task) => {
      return {
        id: task.id,
        titulo: task.title,
        descricao: task.description || null,
        prioridade: this.getPriorityLabel(task.priority),
        dataVencimento: task.dueDate
          ? new Date(task.dueDate).toLocaleDateString("pt-BR")
          : null,
        horaVencimento: task.dueTime || null,
        concluida: task.completed ? "Sim" : "Não",
        lista: task.list?.name || "Inbox",
      };
    });
  }

  private sanitizeLists(lists: any[]): any[] {
    return lists.map((list) => ({
      id: list.id,
      nome: list.name,
      cor: list.color,
      quantidadeTarefas: list._count?.tasks || 0,
    }));
  }

  private sanitizeHabits(habits: any[]): any[] {
    return habits.map((habit) => {
      return {
        id: habit.id,
        nome: habit.name,
        descricao: habit.description || null,
        icone: habit.icon,
        cor: habit.color,
        frequencia: habit.frequency,
        diasAlvo: this.formatTargetDays(habit.targetDays),
        metaDiaria: habit.dailyGoal,
        sequenciaAtual: `${habit.currentStreak || 0} dias`,
        maiorSequencia: `${habit.bestStreak || 0} dias`,
      };
    });
  }

  private getPriorityLabel(priority: number): string {
    const labels: { [key: number]: string } = {
      0: "Nenhuma",
      1: "Baixa",
      2: "Média",
      3: "Alta",
    };
    return labels[priority] || "Nenhuma";
  }

  private formatTargetDays(targetDays: any): string | null {
    if (!targetDays) return null;

    // Se já for um array, fazer join
    if (Array.isArray(targetDays)) {
      return targetDays.join(", ");
    }

    // Se for uma string, tentar parsear como JSON
    if (typeof targetDays === "string") {
      try {
        const parsed = JSON.parse(targetDays);
        if (Array.isArray(parsed)) {
          return parsed.join(", ");
        }
        return targetDays;
      } catch {
        return targetDays;
      }
    }

    return String(targetDays);
  }

  /**
   * Helper to normalize dates.
   * Use date-fns for robust handling if needed in future, currently keeping consistent logic.
   * If sending from AI as YYYY-MM-DD, we ensure it's treated as local date (mid-day to avoid TZ shifts).
   */
  private normalizeDate(args: any) {
    if (
      args.dueDate &&
      typeof args.dueDate === "string" &&
      !args.dueDate.includes("T")
    ) {
      // Append explicit time to ensure it parses as a specific local time,
      // avoiding UTC midnight shifts that might show as previous day.
      args.dueDate = new Date(`${args.dueDate}T12:00:00`).toISOString();
    }
  }
}
