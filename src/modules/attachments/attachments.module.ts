import { Module } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { AttachmentsController } from "./attachments.controller";
import { AttachmentsService } from "./attachments.service";

@Module({
    imports: [
        MulterModule.register({
            dest: "./uploads",
        }),
    ],
    controllers: [AttachmentsController],
    providers: [AttachmentsService],
    exports: [AttachmentsService],
})
export class AttachmentsModule { }
