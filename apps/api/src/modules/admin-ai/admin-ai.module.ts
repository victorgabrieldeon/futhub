import { Module } from '@nestjs/common';
import { AdminCardsModule } from '../admin-cards/admin-cards.module.js';
import { AdminPacksModule } from '../admin-packs/admin-packs.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { AdminAiController } from './admin-ai.controller.js';
import { AdminAiService } from './admin-ai.service.js';
import { AiConfigService } from './ai-config.service.js';
import { AiHistoryService } from './ai-history.service.js';
import { AiHttpClient } from './ai-http-client.js';
import { AiProviderService } from './ai-provider.service.js';
import { AiSessions } from './ai-sessions.js';
import { AiToolsService } from './ai-tools.service.js';
import { AiWebSearchService } from './ai-web-search.service.js';

@Module({
  imports: [AuthModule, AdminCardsModule, AdminPacksModule],
  controllers: [AdminAiController],
  providers: [
    AdminAiService,
    AiHttpClient,
    AiProviderService,
    AiSessions,
    AiToolsService,
    AiHistoryService,
    AiConfigService,
    AiWebSearchService,
  ],
})
export class AdminAiModule {}
