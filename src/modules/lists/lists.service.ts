import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateListDto, UpdateListDto } from "./dto/lists.dto";

@Injectable()
export class ListsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateListDto) {
    const lastList = await this.prisma.list.findFirst({
      where: { userId },
      orderBy: { position: "desc" },
    });

    return this.prisma.list.create({
      data: {
        ...dto,
        userId,
        position: (lastList?.position ?? 0) + 1,
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.list.findMany({
      where: { userId },
      orderBy: { position: "asc" },
      include: {
        _count: {
          select: {
            tasks: {
              where: { deletedAt: null, completedAt: null },
            },
          },
        },
      },
    });
  }

  async findOne(userId: string, listId: string) {
    const list = await this.prisma.list.findFirst({
      where: { id: listId, userId },
    });

    if (!list) {
      throw new NotFoundException("List not found");
    }

    return list;
  }

  async update(userId: string, listId: string, dto: UpdateListDto) {
    await this.findOne(userId, listId);

    return this.prisma.list.update({
      where: { id: listId },
      data: dto,
    });
  }

  async delete(userId: string, listId: string) {
    await this.findOne(userId, listId);

    // Soft-delete all tasks in this list
    await this.prisma.task.updateMany({
      where: { listId, userId },
      data: {
        deletedAt: new Date(),
        listId: null, // Move to Inbox so they aren't orphaned
      },
    });

    // Permanently delete the list
    await this.prisma.list.delete({
      where: { id: listId },
    });

    return { success: true };
  }

  async reorder(userId: string, listId: string, newPosition: number) {
    await this.findOne(userId, listId);

    return this.prisma.list.update({
      where: { id: listId },
      data: { position: newPosition },
    });
  }
}
