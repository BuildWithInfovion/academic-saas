import {
  Module,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
import { PlatformModule } from './platform/platform.module';

import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { TenantGuard } from './common/guards/tenant.guard';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { RequestMetricsInterceptor } from './common/interceptors/request-metrics.interceptor';
import { AuditLogService } from './common/services/audit-log.service';

import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
    PlatformModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // PrismaService available via PrismaModule (global)
    TenantGuard, // ✅ still available for @UseGuards() on controllers
    AuditLogService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestMetricsInterceptor,
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
        { path: 'auth/forgot-password', method: RequestMethod.ALL },
        { path: 'platform', method: RequestMethod.ALL },
        { path: 'platform/(.*)', method: RequestMethod.ALL },
      )
      .forRoutes('*');
  }
}
