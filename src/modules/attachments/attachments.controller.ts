import {
    Controller,
    Get,
    Post,
    Delete,
    Param,
    UseGuards,
    UseInterceptors,
    UploadedFile,
    Res,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { diskStorage } from "multer";
import { v4 as uuidv4 } from "uuid";
import * as path from "path";
import { AttachmentsService } from "./attachments.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

@Controller()
@UseGuards(JwtAuthGuard)
export class AttachmentsController {
    constructor(private attachmentsService: AttachmentsService) { }

    @Post("tasks/:taskId/attachments")
    @UseInterceptors(
        FileInterceptor("file", {
            storage: diskStorage({
                destination: "./uploads",
                filename: (_req, file, cb) => {
                    const ext = path.extname(file.originalname);
                    cb(null, `${uuidv4()}${ext}`);
                },
            }),
        }),
    )
    upload(
        @CurrentUser("sub") userId: string,
        @Param("taskId") taskId: string,
        @UploadedFile() file: Express.Multer.File,
    ) {
        return this.attachmentsService.upload(userId, taskId, file);
    }

    @Get("tasks/:taskId/attachments")
    findByTask(
        @CurrentUser("sub") userId: string,
        @Param("taskId") taskId: string,
    ) {
        return this.attachmentsService.findByTask(userId, taskId);
    }

    @Get("attachments/:id/download")
    async download(
        @CurrentUser("sub") userId: string,
        @Param("id") attachmentId: string,
        @Res() res: Response,
    ) {
        const { path: filePath, filename, mimeType } =
            await this.attachmentsService.getFilePath(userId, attachmentId);

        res.set({
            "Content-Type": mimeType,
            "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        });

        res.sendFile(filePath);
    }

    @Delete("attachments/:id")
    delete(
        @CurrentUser("sub") userId: string,
        @Param("id") attachmentId: string,
    ) {
        return this.attachmentsService.delete(userId, attachmentId);
    }
}
