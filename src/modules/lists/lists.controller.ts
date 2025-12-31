import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from "@nestjs/common";
import { ListsService } from "./lists.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { CreateListDto, UpdateListDto } from "./dto/lists.dto";

@Controller("lists")
@UseGuards(JwtAuthGuard)
export class ListsController {
  constructor(private listsService: ListsService) {}

  @Post()
  create(@CurrentUser("sub") userId: string, @Body() dto: CreateListDto) {
    return this.listsService.create(userId, dto);
  }

  @Get()
  findAll(@CurrentUser("sub") userId: string) {
    return this.listsService.findAll(userId);
  }

  @Get(":id")
  findOne(@CurrentUser("sub") userId: string, @Param("id") id: string) {
    return this.listsService.findOne(userId, id);
  }

  @Put(":id")
  update(
    @CurrentUser("sub") userId: string,
    @Param("id") id: string,
    @Body() dto: UpdateListDto,
  ) {
    return this.listsService.update(userId, id, dto);
  }

  @Delete(":id")
  delete(@CurrentUser("sub") userId: string, @Param("id") id: string) {
    return this.listsService.delete(userId, id);
  }

  @Put(":id/reorder")
  reorder(
    @CurrentUser("sub") userId: string,
    @Param("id") id: string,
    @Body("position") position: number,
  ) {
    return this.listsService.reorder(userId, id, position);
  }
}
