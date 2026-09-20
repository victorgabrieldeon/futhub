import { Module } from '@nestjs/common';

import { ClubController } from './club.controller.js';
import { ClubService } from './club.service.js';

@Module({ controllers: [ClubController], providers: [ClubService] })
export class ClubModule {}
