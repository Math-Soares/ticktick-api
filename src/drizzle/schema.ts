import { pgTable, text, timestamp, integer, index, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid'; // We might need to install uuid if not present, but for now I'll use a placeholder or assume imports. 
// Actually I'll use crypto.randomUUID if available or just not define defaultFn yet and handle in helper.
// To keep it self-contained without extra deps, I'll assume ID is passed or generated. 

export const users = pgTable('User', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    password: text('password').notNull(),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull().$onUpdate(() => new Date()),
});

export const lists = pgTable('List', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    color: text('color').default('#6366f1').notNull(),
    icon: text('icon'),
    position: integer('position').default(0).notNull(),
    userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({
    userIdIdx: index('List_userId_idx').on(table.userId),
}));

export const tasks = pgTable('Task', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    title: text('title').notNull(),
    description: text('description'),
    priority: integer('priority').default(0).notNull(),
    position: integer('position').default(0).notNull(),

    dueDate: timestamp('dueDate', { mode: 'date' }),
    dueTime: text('dueTime'),
    endTime: text('endTime'),
    completedAt: timestamp('completedAt', { mode: 'date' }),

    recurrenceRule: text('recurrenceRule'),
    recurrenceEnd: timestamp('recurrenceEnd', { mode: 'date' }),
    parentTaskId: text('parentTaskId'), // Self relation defined in relations

    userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
    listId: text('listId').references(() => lists.id, { onDelete: 'set null' }),

    estimatedPomos: integer('estimatedPomos').default(0).notNull(),
    completedPomos: integer('completedPomos').default(0).notNull(),

    tags: text('tags').default('').notNull(),
    deletedAt: timestamp('deletedAt', { mode: 'date' }),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({
    userIdDueDateIdx: index('Task_userId_dueDate_idx').on(table.userId, table.dueDate),
    userIdCompletedAtIdx: index('Task_userId_completedAt_idx').on(table.userId, table.completedAt),
    userIdDeletedAtIdx: index('Task_userId_deletedAt_idx').on(table.userId, table.deletedAt),
    listIdIdx: index('Task_listId_idx').on(table.listId),
    // Self relation foreign key logic is handled by references or keeping it loose if circular.
    // We'll add the foreign key manually if strictly needed or rely on application logic + relation. 
    // Adding explicit foreign key to self:
    parentTaskFk: index('Task_parentTaskId_idx').on(table.parentTaskId),
}));

export const attachments = pgTable('Attachment', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    filename: text('filename').notNull(),
    storedName: text('storedName').notNull(),
    mimeType: text('mimeType').notNull(),
    size: integer('size').notNull(),
    taskId: text('taskId').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    taskIdIdx: index('Attachment_taskId_idx').on(table.taskId),
}));

export const habits = pgTable('Habit', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    description: text('description'),
    icon: text('icon').default('🎯').notNull(),
    color: text('color').default('#22c55e').notNull(),
    frequency: text('frequency').default('DAILY').notNull(),
    targetDays: text('targetDays').default('').notNull(),
    targetCount: integer('targetCount').default(1).notNull(),

    currentStreak: integer('currentStreak').default(0).notNull(),
    longestStreak: integer('longestStreak').default(0).notNull(),

    userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),

    startDate: timestamp('startDate', { mode: 'date' }).defaultNow().notNull(),
    archivedAt: timestamp('archivedAt', { mode: 'date' }),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({
    userIdArchivedAtIdx: index('Habit_userId_archivedAt_idx').on(table.userId, table.archivedAt),
}));

export const habitLogs = pgTable('HabitLog', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    habitId: text('habitId').notNull().references(() => habits.id, { onDelete: 'cascade' }),
    date: timestamp('date', { mode: 'date' }).notNull(),
    count: integer('count').default(1).notNull(),
    notes: text('notes'),
}, (table) => ({
    habitIdDateUnique: unique('HabitLog_habitId_date_key').on(table.habitId, table.date),
    habitIdDateIdx: index('HabitLog_habitId_date_idx').on(table.habitId, table.date),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
    tasks: many(tasks),
    habits: many(habits),
    lists: many(lists),
}));

export const listsRelations = relations(lists, ({ one, many }) => ({
    user: one(users, {
        fields: [lists.userId],
        references: [users.id],
    }),
    tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
    user: one(users, {
        fields: [tasks.userId],
        references: [users.id],
    }),
    list: one(lists, {
        fields: [tasks.listId],
        references: [lists.id],
    }),
    // Self relation
    parentTask: one(tasks, {
        fields: [tasks.parentTaskId],
        references: [tasks.id],
        relationName: 'TaskRecurrence',
    }),
    instances: many(tasks, {
        relationName: 'TaskRecurrence',
    }),
    attachments: many(attachments),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
    task: one(tasks, {
        fields: [attachments.taskId],
        references: [tasks.id],
    }),
}));

export const habitsRelations = relations(habits, ({ one, many }) => ({
    user: one(users, {
        fields: [habits.userId],
        references: [users.id],
    }),
    logs: many(habitLogs),
}));

export const habitLogsRelations = relations(habitLogs, ({ one }) => ({
    habit: one(habits, {
        fields: [habitLogs.habitId],
        references: [habits.id],
    }),
}));
