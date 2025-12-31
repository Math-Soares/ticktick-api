import { Module } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { AttachmentsController } from "./attachments.controller";
import { AttachmentsService } from "./attachments.service";
import { PrismaModule } from "../../prisma/prisma.module";

@Module({
    imports: [
        PrismaModule,
        MulterModule.register({
            dest: "./uploads",
        }),
    ],
    controllers: [AttachmentsController],
    providers: [AttachmentsService],
    exports: [AttachmentsService],
})
export class AttachmentsModule { }
