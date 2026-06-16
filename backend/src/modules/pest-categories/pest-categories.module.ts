// src/modules/pest-categories/pest-categories.module.ts
import { Module } from '@nestjs/common';
import { PestCategoriesController } from './pest-categories.controller';
import { PestCategoriesService } from './pest-categories.service';

@Module({
  controllers: [PestCategoriesController],
  providers: [PestCategoriesService],
  exports: [PestCategoriesService],
})
export class PestCategoriesModule {}
