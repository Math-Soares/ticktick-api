import {
  IsString,
  IsOptional,
  IsDateString,
  IsInt,
  Min,
  Max,
} from "class-validator";

export class QuickAddDto {
  @IsString()
  input: string;

  @IsString()
  @IsOptional()
  listId?: string;
}

export class CreateTaskDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(0)
  @Max(3)
  @IsOptional()
  priority?: number;

  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @IsString()
  @IsOptional()
  dueTime?: string;

  @IsString()
  @IsOptional()
  endTime?: string;

  @IsString()
  @IsOptional()
  recurrenceRule?: string;

  @IsString()
  @IsOptional()
  listId?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  estimatedPomos?: number;

  @IsString()
  @IsOptional()
  tags?: string;
}

export class UpdateTaskDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(0)
  @Max(3)
  @IsOptional()
  priority?: number;

  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @IsString()
  @IsOptional()
  dueTime?: string;

  @IsString()
  @IsOptional()
  endTime?: string;

  @IsString()
  @IsOptional()
  recurrenceRule?: string;

  @IsString()
  @IsOptional()
  listId?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  estimatedPomos?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  completedPomos?: number;

  @IsString()
  @IsOptional()
  tags?: string;
}
