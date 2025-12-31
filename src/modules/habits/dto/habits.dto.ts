import { IsString, IsOptional, IsInt, IsEnum, Min } from "class-validator";

export enum HabitFrequency {
  DAILY = "DAILY",
  WEEKLY = "WEEKLY",
  MONTHLY = "MONTHLY",
}

export class CreateHabitDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsEnum(HabitFrequency)
  @IsOptional()
  frequency?: HabitFrequency;

  @IsString()
  @IsOptional()
  targetDays?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  targetCount?: number;
}

export class UpdateHabitDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsEnum(HabitFrequency)
  @IsOptional()
  frequency?: HabitFrequency;

  @IsString()
  @IsOptional()
  targetDays?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  targetCount?: number;
}

export class LogHabitDto {
  @IsString()
  @IsOptional()
  date?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
