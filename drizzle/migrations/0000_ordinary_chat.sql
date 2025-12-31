CREATE TABLE "Attachment" (
	"id" text PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"storedName" text NOT NULL,
	"mimeType" text NOT NULL,
	"size" integer NOT NULL,
	"taskId" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "HabitLog" (
	"id" text PRIMARY KEY NOT NULL,
	"habitId" text NOT NULL,
	"date" timestamp NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"notes" text,
	CONSTRAINT "HabitLog_habitId_date_key" UNIQUE("habitId","date")
);
--> statement-breakpoint
CREATE TABLE "Habit" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon" text DEFAULT '🎯' NOT NULL,
	"color" text DEFAULT '#22c55e' NOT NULL,
	"frequency" text DEFAULT 'DAILY' NOT NULL,
	"targetDays" text DEFAULT '' NOT NULL,
	"targetCount" integer DEFAULT 1 NOT NULL,
	"currentStreak" integer DEFAULT 0 NOT NULL,
	"longestStreak" integer DEFAULT 0 NOT NULL,
	"userId" text NOT NULL,
	"startDate" timestamp DEFAULT now() NOT NULL,
	"archivedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "List" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"icon" text,
	"position" integer DEFAULT 0 NOT NULL,
	"userId" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Task" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"priority" integer DEFAULT 0 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"dueDate" timestamp,
	"dueTime" text,
	"endTime" text,
	"completedAt" timestamp,
	"recurrenceRule" text,
	"recurrenceEnd" timestamp,
	"parentTaskId" text,
	"userId" text NOT NULL,
	"listId" text,
	"estimatedPomos" integer DEFAULT 0 NOT NULL,
	"completedPomos" integer DEFAULT 0 NOT NULL,
	"tags" text DEFAULT '' NOT NULL,
	"deletedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "User_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_taskId_Task_id_fk" FOREIGN KEY ("taskId") REFERENCES "public"."Task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "HabitLog" ADD CONSTRAINT "HabitLog_habitId_Habit_id_fk" FOREIGN KEY ("habitId") REFERENCES "public"."Habit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Habit" ADD CONSTRAINT "Habit_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "List" ADD CONSTRAINT "List_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Task" ADD CONSTRAINT "Task_listId_List_id_fk" FOREIGN KEY ("listId") REFERENCES "public"."List"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "Attachment_taskId_idx" ON "Attachment" USING btree ("taskId");--> statement-breakpoint
CREATE INDEX "HabitLog_habitId_date_idx" ON "HabitLog" USING btree ("habitId","date");--> statement-breakpoint
CREATE INDEX "Habit_userId_archivedAt_idx" ON "Habit" USING btree ("userId","archivedAt");--> statement-breakpoint
CREATE INDEX "List_userId_idx" ON "List" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "Task_userId_dueDate_idx" ON "Task" USING btree ("userId","dueDate");--> statement-breakpoint
CREATE INDEX "Task_userId_completedAt_idx" ON "Task" USING btree ("userId","completedAt");--> statement-breakpoint
CREATE INDEX "Task_userId_deletedAt_idx" ON "Task" USING btree ("userId","deletedAt");--> statement-breakpoint
CREATE INDEX "Task_listId_idx" ON "Task" USING btree ("listId");--> statement-breakpoint
CREATE INDEX "Task_parentTaskId_idx" ON "Task" USING btree ("parentTaskId");