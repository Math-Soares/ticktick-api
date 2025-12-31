import {
    Injectable,
    NotFoundException,
    BadRequestException,
    Inject,
} from "@nestjs/common";
import { DRIZZLE } from "../../drizzle/drizzle.provider";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
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

    constructor(@Inject(DRIZZLE) private db: NodePgDatabase<typeof schema>) {
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

    async upload(userId: string, taskId: string, file: Express.Multer.File) {
        // Verify task ownership
        const task = await this.db.query.tasks.findFirst({
            where: and(eq(schema.tasks.id, taskId), eq(schema.tasks.userId, userId)),
        });
        if (!task) {
            throw new NotFoundException("Task not found");
        }

        this.validateFile(file);

        // Create attachment record
        const [attachment] = await this.db
            .insert(schema.attachments)
            .values({
                filename: file.originalname,
                storedName: file.filename,
                mimeType: file.mimetype,
                size: file.size,
                taskId,
            })
            .returning();

        return attachment;
    }

    async findByTask(userId: string, taskId: string) {
        // Verify task ownership
        const task = await this.db.query.tasks.findFirst({
            where: and(eq(schema.tasks.id, taskId), eq(schema.tasks.userId, userId)),
        });
        if (!task) {
            throw new NotFoundException("Task not found");
        }

        return this.db.query.attachments.findMany({
            where: eq(schema.attachments.taskId, taskId),
            orderBy: [desc(schema.attachments.createdAt)],
        });
    }

    async getFilePath(userId: string, attachmentId: string) {
        const attachment = await this.db.query.attachments.findFirst({
            where: eq(schema.attachments.id, attachmentId),
            with: { task: true },
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
        const attachment = await this.db.query.attachments.findFirst({
            where: eq(schema.attachments.id, attachmentId),
            with: { task: true },
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
        await this.db
            .delete(schema.attachments)
            .where(eq(schema.attachments.id, attachmentId));

        return { success: true };
    }
}
