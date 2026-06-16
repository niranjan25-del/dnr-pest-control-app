// src/modules/service-reports/service-reports.module.ts
//
// Imports MediaModule for S3Service (signature + PDF storage; before/after photos are uploaded
// via the media module and referenced here by mediaId). Exports the service for potential
// triggering from the check-out flow (Step 16).

import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { ServiceReportsController } from './service-reports.controller';
import { ServiceReportsService } from './service-reports.service';
import { ReportGeneratorService } from './report-generator.service';
import { SignatureService } from './signature.service';
import { ComplianceService } from './compliance.service';

@Module({
  imports: [MediaModule],
  controllers: [ServiceReportsController],
  providers: [ServiceReportsService, ReportGeneratorService, SignatureService, ComplianceService],
  exports: [ServiceReportsService],
})
export class ServiceReportsModule {}
