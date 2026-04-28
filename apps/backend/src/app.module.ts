import {
  Module,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { PrismaModule } from './prisma/prisma.module';
import { InstitutionModule } from './institution/institution.module';
import { StudentModule } from './modules/student/student.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { AuthModule } from './modules/auth/auth.module';
import { AcademicModule } from './modules/academic/academic.module';
import { InquiryModule } from './modules/inquiry/inquiry.module';
import { SubjectModule } from './modules/subject/subject.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { FeesModule } from './modules/fees/fees.module';
import { ExamModule } from './modules/exam/exam.module';
import { AnnouncementModule } from './modules/announcement/announcement.module';
import { TimetableModule } from './modules/timetable/timetable.module';
import { StaffAttendanceModule } from './modules/staff-attendance/staff-attendance.module';
import { TcModule } from './modules/tc/tc.module';
import { SupportModule } from './modules/support/support.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { SalaryModule } from './modules/salary/salary.module';
import { DocumentModule } from './modules/document/document.module';
import { AuditModule } from './modules/audit/audit.module';
import { PlatformModule } from './platform/platform.module';

import { StorageModule } from './common/storage/storage.module';
import { CleanupModule } from './common/cleanup/cleanup.module';
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { TenantGuard } from './common/guards/tenant.guard';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { RequestMetricsInterceptor } from './common/interceptors/request-metrics.interceptor';
import { HttpCacheInterceptor } from './common/interceptors/http-cache.interceptor';
import { AuditLogService } from './common/services/audit-log.service';
import { AppCacheModule } from './common/cache/app-cache.module';

import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    AppCacheModule,   // Global — AppCacheService injectable everywhere
    StorageModule,    // Global — StorageService injectable everywhere
    PrismaModule,
    InstitutionModule,
    StudentModule,
    UsersModule,
    RolesModule,
    AuthModule,
    AcademicModule,
    InquiryModule,
    SubjectModule,
    AttendanceModule,
    FeesModule,
    ExamModule,
    AnnouncementModule,
    TimetableModule,
    StaffAttendanceModule,
    TcModule,
    SupportModule,
    CalendarModule,
    SalaryModule,
    DocumentModule,
    AuditModule,
    CleanupModule,
    PlatformModule,
  ],
  controllers: [AppController],
  providers: [
    // PrismaService available via PrismaModule (global)
    TenantGuard, // ✅ still available for @UseGuards() on controllers
    AuditLogService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestMetricsInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpCacheInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .exclude(
        { path: 'auth/login', method: RequestMethod.ALL },
        { path: 'auth/refresh', method: RequestMethod.ALL },
        { path: 'auth/refresh-op', method: RequestMethod.ALL },
        { path: 'auth/forgot-password', method: RequestMethod.ALL },
        { path: 'auth/reset-password', method: RequestMethod.ALL },
        { path: 'auth/totp/authenticate', method: RequestMethod.ALL },
        { path: 'auth/parent/login', method: RequestMethod.ALL },
        { path: 'platform', method: RequestMethod.ALL },
        { path: 'platform/*path', method: RequestMethod.ALL },
        { path: 'support/*path', method: RequestMethod.ALL },
        { path: 'health', method: RequestMethod.ALL },
        { path: 'ping', method: RequestMethod.ALL },
      )
      .forRoutes('*');
  }
}
