// src/modules/addresses/addresses.module.ts
//
// Imports ServiceAreasModule to reuse coverage checks for eligibility. Exports AddressesService
// so the booking flow can call assertBookableAddress().

import { Module } from '@nestjs/common';
import { ServiceAreasModule } from '../service-areas/service-areas.module';
import { AddressesController } from './addresses.controller';
import { AddressesService } from './addresses.service';
import { GeocodingService } from './geocoding.service';

@Module({
  imports: [ServiceAreasModule],
  controllers: [AddressesController],
  providers: [AddressesService, GeocodingService],
  exports: [AddressesService],
})
export class AddressesModule {}
