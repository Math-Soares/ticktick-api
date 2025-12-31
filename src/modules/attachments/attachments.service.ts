import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import * as fs from "fs";
import * as path from "path";

const ALLOWED_EXTENSIONS = [
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".txt",
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".zip",
    ".rar",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

@Injectable()
export class AttachmentsService {
    private readonly uploadDir: string;

    constructor(private prisma: PrismaService) {
        this.uploadDir = path.join(process.cwd(), "uploads");
        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
        }
    }

    validateFile(file: Express.Multer.File) {
        const ext = path.extname(file.originalname).toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            throw new BadRequestException(
                `File type not allowed. Allowed types: ${ALLOWED_EXTENSIONS.join(", ")}`,
            );
        }
        if (file.size > MAX_FILE_SIZE) {
            throw new BadRequestException(
                `File too large. Maximum size: ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
            );
        }
    }

    async upload(
        userId: string,
        taskId: string,
        file: Express.Multer.File,
    ) {
        // Verify task ownership
        const task = await this.prisma.task.findFirst({
            where: { id: taskId, userId },
        });
        if (!task) {
            throw new NotFoundException("Task not found");
        }

        this.validateFile(file);

        // Create attachment record
        const attachment = await this.prisma.attachment.create({
            data: {
                filename: file.originalname,
                storedName: file.filename,
                mimeType: file.mimetype,
                size: file.size,
                taskId,
            },
        });

        return attachment;
    }

    async findByTask(userId: string, taskId: string) {
        // Verify task ownership
        const task = await this.prisma.task.findFirst({
            where: { id: taskId, userId },
        });
        if (!task) {
            throw new NotFoundException("Task not found");
        }

        return this.prisma.attachment.findMany({
            where: { taskId },
            orderBy: { createdAt: "desc" },
        });
    }

    async getFilePath(userId: string, attachmentId: string) {
        const attachment = await this.prisma.attachment.findUnique({
            where: { id: attachmentId },
            include: { task: true },
        });

        if (!attachment || attachment.task.userId !== userId) {
            throw new NotFoundException("Attachment not found");
        }

        const filePath = path.join(this.uploadDir, attachment.storedName);
        if (!fs.existsSync(filePath)) {
            throw new NotFoundException("File not found on disk");
        }

        return {
            path: filePath,
            filename: attachment.filename,
            mimeType: attachment.mimeType,
        };
    }

    async delete(userId: string, attachmentId: string) {
        const attachment = await this.prisma.attachment.findUnique({
            where: { id: attachmentId },
            include: { task: true },
        });

        if (!attachment || attachment.task.userId !== userId) {
            throw new NotFoundException("Attachment not found");
        }

        // Delete file from disk
        const filePath = path.join(this.uploadDir, attachment.storedName);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Delete database record
        await this.prisma.attachment.delete({
            where: { id: attachmentId },
        });

        return { success: true };
    }
}
