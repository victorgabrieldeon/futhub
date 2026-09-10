import { Inject, Injectable } from '@nestjs/common';
import { AdminCardsService } from '../admin-cards/admin-cards.service.js';
import { PlayerPhotosService } from '../admin-cards/player-photos.service.js';
import { AdminPacksService } from '../admin-packs/admin-packs.service.js';
import type { AiCommand, AiMutation } from './ai-tools.js';
import { AiWebSearchService } from './ai-web-search.service.js';

@Injectable()
export class AiToolsService {
  constructor(
    @Inject(AdminCardsService) private readonly cards: AdminCardsService,
    @Inject(AdminPacksService) private readonly packs: AdminPacksService,
    @Inject(PlayerPhotosService) private readonly playerPhotos: PlayerPhotosService,
    @Inject(AiWebSearchService) private readonly web: AiWebSearchService,
  ) {}

  webAvailable(): boolean {
    return this.web.available();
  }

  async read(command: Exclude<AiCommand, AiMutation>): Promise<string> {
    switch (command.name) {
      case 'web_search':
        return this.web.search(command.input.query);
      case 'search_teams':
        return JSON.stringify(await this.cards.teams({ ...command.input, pageSize: 20 }));
      case 'search_team_players':
        return JSON.stringify(await this.playerPhotos.teamPlayers(command.input.team));
      case 'search_collections':
        return JSON.stringify(await this.cards.collections({ ...command.input, pageSize: 20 }));
      case 'search_cards':
        return JSON.stringify(await this.cards.list({ ...command.input, pageSize: 20 }));
      case 'list_packs': {
        const { db, schema } = await import('@futhub/database');
        const packs = await db.select().from(schema.packs).orderBy(schema.packs.name).limit(51);
        return JSON.stringify({ items: packs.slice(0, 50), hasMore: packs.length > 50 });
      }
    }
  }

  async execute(command: AiMutation): Promise<string> {
    switch (command.name) {
      case 'create_team':
        return JSON.stringify(await this.cards.createTeam(command.input));
      case 'create_collection':
        return JSON.stringify(await this.cards.createCollection(command.input));
      case 'create_card':
        return JSON.stringify(await this.cards.create(command.input));
      case 'create_pack':
        return JSON.stringify(await this.packs.create({ ...command.input, imageUrl: null }));
    }
  }
}
