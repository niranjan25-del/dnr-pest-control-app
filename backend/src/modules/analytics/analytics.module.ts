// src/modules/analytics/analytics.module.ts
//
// Read-heavy reporting module. Imports MediaModule for S3Service (export storage). No schema or
// write paths — pure aggregation over existing data.

import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { DashboardService } from './dashboard.service';
import { ReportsService } from './reports.service';
import { ExportService } from './export.service';

@Module({
  imports: [MediaModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, DashboardService, ReportsService, ExportService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
