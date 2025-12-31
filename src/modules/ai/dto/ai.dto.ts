import { IsString, IsArray, IsOptional, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class MessageDto {
  @IsString()
  role: "user" | "assistant" | "system";

  @IsString()
  content: string;
}

export class ChatDto {
  @IsString()
  message: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => MessageDto)
  history?: MessageDto[];
}
