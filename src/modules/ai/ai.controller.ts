import { Controller, Post, Get, Body, UseGuards } from "@nestjs/common";
import { AiService } from "./ai.service";
import { ChatDto } from "./dto/ai.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

@Controller("ai")
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) { }

  @Post("chat")
  async chat(@CurrentUser("sub") userId: string, @Body() dto: ChatDto) {
    return this.aiService.chat(userId, dto);
  }

  @Get("briefing")
  async getBriefing(@CurrentUser("sub") userId: string) {
    return this.aiService.generateDailyBriefing(userId);
  }
}
