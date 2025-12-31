import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from './supabase/supabase.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { ListsModule } from './modules/lists/lists.module';
import { HabitsModule } from './modules/habits/habits.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { AiModule } from './modules/ai/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SupabaseModule,
    PrismaModule,
    AuthModule,
    TasksModule,
    ListsModule,
    HabitsModule,
    AttachmentsModule,
    AiModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }
