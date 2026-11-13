import '@fastify/multipart';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { AdminAuthGuard } from '../auth/admin-auth.guard.js';
import { imageFile } from '../files/files.service.js';
import {
  type AdminCard,
  AdminCardSchema,
  type AdminCollection,
  AdminCollectionSchema,
  type AdminTeam,
  AdminTeamSchema,
  type CardCatalog,
  CardCatalogSchema,
  type CardInput,
  CardInputSchema,
  type CardListQuery,
  CardListQuerySchema,
  type CardPage,
  CardPageSchema,
  type CardTemplate,
  CardTemplateSchema,
  type CardUpdate,
  CardUpdateSchema,
  type CollectionArtworkSuggestion,
  CollectionArtworkSuggestionSchema,
  type CollectionArtworkSuggestionsQuery,
  CollectionArtworkSuggestionsQuerySchema,
  type CollectionInput,
  CollectionInputSchema,
  type CollectionListQuery,
  CollectionListQuerySchema,
  type CollectionPage,
  CollectionPageSchema,
  type ImportPreview,
  ImportPreviewSchema,
  type PlayerPhotoSuggestion,
  PlayerPhotoSuggestionSchema,
  type PlayerPhotoSuggestionsQuery,
  PlayerPhotoSuggestionsQuerySchema,
  type SquadImportClub,
  SquadImportClubSchema,
  type SquadImportClubsQuery,
  SquadImportClubsQuerySchema,
  type SquadImportInput,
  SquadImportInputSchema,
  type SquadImportLeague,
  type SquadImportLeagueClubsQuery,
  SquadImportLeagueClubsQuerySchema,
  SquadImportLeagueSchema,
  type SquadImportPreview,
  SquadImportPreviewSchema,
  type SquadImportResult,
  SquadImportResultSchema,
  type SquadImportSquadQuery,
  SquadImportSquadQuerySchema,
  type TeamInput,
  TeamInputSchema,
  type TeamListQuery,
  TeamListQuerySchema,
  type TeamLogoDetails,
  type TeamLogoDetailsQuery,
  TeamLogoDetailsQuerySchema,
  TeamLogoDetailsSchema,
  type TeamLogoSuggestion,
  TeamLogoSuggestionSchema,
  type TeamLogoSuggestionsQuery,
  TeamLogoSuggestionsQuerySchema,
  type TeamPage,
  TeamPageSchema,
} from './admin-cards.dto.js';
import { AdminCardsService } from './admin-cards.service.js';
import { SquadImportService } from './squad-import.service.js';

@ApiTags('Administração / Cards')
@Controller('v1/admin/cards')
@UseGuards(AdminAuthGuard)
export class AdminCardsController {
  constructor(
    @Inject(AdminCardsService) private readonly cards: AdminCardsService,
    @Inject(SquadImportService) private readonly squadImport: SquadImportService,
  ) {}

  @Get('catalog')
  @ApiOkResponse({ standardSchema: CardCatalogSchema })
  catalog(): Promise<CardCatalog> {
    return this.cards.catalog();
  }

  @Get('team-logo-suggestions')
  @ApiOkResponse({ standardSchema: z.array(TeamLogoSuggestionSchema) })
  teamLogoSuggestions(
    @Query({ schema: TeamLogoSuggestionsQuerySchema }) query: TeamLogoSuggestionsQuery,
  ): Promise<TeamLogoSuggestion[]> {
    return this.cards.teamLogoSuggestions(query.q);
  }

  @Get('team-logo-details')
  @ApiOkResponse({ standardSchema: TeamLogoDetailsSchema })
  teamLogoDetails(
    @Query({ schema: TeamLogoDetailsQuerySchema }) query: TeamLogoDetailsQuery,
  ): Promise<TeamLogoDetails> {
    return this.cards.teamLogoDetails(query.slug);
  }

  @Get('team-logos/:filename')
  async teamLogo(
    @Param('filename') filename: string,
    @Res() response: FastifyReply,
  ): Promise<void> {
    if (!filename.endsWith('.svg')) throw new BadRequestException('Team logo must be an SVG.');
    const image = await this.cards.teamLogo(filename.slice(0, -4));
    response
      .header('cache-control', 'private, max-age=86400')
      .type(image.contentType)
      .send(image.buffer);
  }
  @Get('collection-artwork-suggestions')
  @ApiOkResponse({ standardSchema: z.array(CollectionArtworkSuggestionSchema) })
  collectionArtworkSuggestions(
    @Query({ schema: CollectionArtworkSuggestionsQuerySchema })
    query: CollectionArtworkSuggestionsQuery,
  ): Promise<CollectionArtworkSuggestion[]> {
    return this.cards.collectionArtworkSuggestions(query.q);
  }

  @Get('player-photo-suggestions')
  @ApiOkResponse({ standardSchema: z.array(PlayerPhotoSuggestionSchema) })
  playerPhotoSuggestions(
    @Query({ schema: PlayerPhotoSuggestionsQuerySchema }) query: PlayerPhotoSuggestionsQuery,
  ): Promise<PlayerPhotoSuggestion[]> {
    return this.cards.playerPhotoSuggestions(query.q);
  }

  @Get('player-photos/:filename')
  async playerPhoto(
    @Param('filename') filename: string,
    @Res() response: FastifyReply,
  ): Promise<void> {
    const image = await this.cards.playerPhoto(filename);
    response
      .header('cache-control', 'private, max-age=86400')
      .type(image.contentType)
      .send(image.buffer);
  }

  @Get('player-photos/:kind/:filename')
  async playerPhotoVariant(
    @Param('kind') kind: string,
    @Param('filename') filename: string,
    @Res() response: FastifyReply,
  ): Promise<void> {
    const image = await this.cards.playerPhoto(kind, filename);
    response
      .header('cache-control', 'private, max-age=86400')
      .type(image.contentType)
      .send(image.buffer);
  }

  @Get('squad-import/clubs')
  @ApiOkResponse({ standardSchema: z.array(SquadImportClubSchema) })
  squadImportClubs(
    @Query({ schema: SquadImportClubsQuerySchema }) query: SquadImportClubsQuery,
  ): Promise<SquadImportClub[]> {
    return this.squadImport.clubs(query.q);
  }

  @Get('squad-import/leagues')
  @ApiOkResponse({ standardSchema: z.array(SquadImportLeagueSchema) })
  squadImportLeagues(): Promise<SquadImportLeague[]> {
    return this.squadImport.leagues();
  }

  @Get('squad-import/league-clubs')
  @ApiOkResponse({ standardSchema: z.array(SquadImportClubSchema) })
  squadImportLeagueClubs(
    @Query({ schema: SquadImportLeagueClubsQuerySchema }) query: SquadImportLeagueClubsQuery,
  ): Promise<SquadImportClub[]> {
    return this.squadImport.leagueClubs(query.leagueId);
  }

  @Get('squad-import/squad')
  @ApiOkResponse({ standardSchema: SquadImportPreviewSchema })
  squadImportSquad(
    @Query({ schema: SquadImportSquadQuerySchema }) query: SquadImportSquadQuery,
  ): Promise<SquadImportPreview> {
    return this.squadImport.squad(query);
  }

  @Post('squad-import')
  @HttpCode(200)
  @ApiOkResponse({ standardSchema: SquadImportResultSchema })
  importSquad(
    @Body({ schema: SquadImportInputSchema }) input: SquadImportInput,
  ): Promise<SquadImportResult> {
    return this.squadImport.import(input);
  }

  @Get('collections')
  @ApiOkResponse({ standardSchema: CollectionPageSchema })
  collections(
    @Query({ schema: CollectionListQuerySchema }) query: CollectionListQuery,
  ): Promise<CollectionPage> {
    return this.cards.collections(query);
  }

  @Post('collections')
  @ApiCreatedResponse({ standardSchema: AdminCollectionSchema })
  createCollection(
    @Body({ schema: CollectionInputSchema }) input: CollectionInput,
  ): Promise<AdminCollection> {
    return this.cards.createCollection(input);
  }

  @Put('collections/:collectionId')
  @ApiOkResponse({ standardSchema: AdminCollectionSchema })
  updateCollection(
    @Param('collectionId') collectionId: string,
    @Body({ schema: CollectionInputSchema }) input: CollectionInput,
  ): Promise<AdminCollection> {
    return this.cards.updateCollection(collectionId, input);
  }

  @Delete('collections/:collectionId')
  @HttpCode(204)
  async removeCollection(@Param('collectionId') collectionId: string): Promise<void> {
    await this.cards.removeCollection(collectionId);
  }

  @Get('teams')
  @ApiOkResponse({ standardSchema: TeamPageSchema })
  teams(@Query({ schema: TeamListQuerySchema }) query: TeamListQuery): Promise<TeamPage> {
    return this.cards.teams(query);
  }

  @Post('teams')
  @ApiCreatedResponse({ standardSchema: AdminTeamSchema })
  createTeam(@Body({ schema: TeamInputSchema }) input: TeamInput): Promise<AdminTeam> {
    return this.cards.createTeam(input);
  }

  @Put('teams/:teamId')
  @ApiOkResponse({ standardSchema: AdminTeamSchema })
  updateTeam(
    @Param('teamId') teamId: string,
    @Body({ schema: TeamInputSchema }) input: TeamInput,
  ): Promise<AdminTeam> {
    return this.cards.updateTeam(teamId, input);
  }

  @Delete('teams/:teamId')
  @HttpCode(204)
  async removeTeam(@Param('teamId') teamId: string): Promise<void> {
    await this.cards.removeTeam(teamId);
  }

  @Get('template')
  @ApiOkResponse({ standardSchema: CardTemplateSchema })
  async template(): Promise<CardTemplate> {
    return {
      filename: 'futhub-cards.xlsx',
      content: (await this.cards.template()).toString('base64'),
    };
  }

  @Post('preview')
  @HttpCode(200)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @ApiOkResponse({ standardSchema: ImportPreviewSchema })
  async preview(@Req() request: FastifyRequest): Promise<ImportPreview> {
    return this.cards.preview(await workbook(request));
  }

  @Post('import')
  @HttpCode(200)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @ApiOkResponse({ standardSchema: ImportPreviewSchema })
  async import(@Req() request: FastifyRequest): Promise<ImportPreview> {
    return this.cards.import(await workbook(request));
  }

  @Get()
  @ApiOkResponse({ standardSchema: CardPageSchema })
  list(@Query({ schema: CardListQuerySchema }) query: CardListQuery): Promise<CardPage> {
    return this.cards.list(query);
  }

  @Post()
  @ApiCreatedResponse({ standardSchema: AdminCardSchema })
  create(@Body({ schema: CardInputSchema }) input: CardInput): Promise<AdminCard> {
    return this.cards.create(input);
  }

  @Get(':cardId')
  @ApiOkResponse({ standardSchema: AdminCardSchema })
  get(@Param('cardId') cardId: string): Promise<AdminCard> {
    return this.cards.get(cardId);
  }

  @Put(':cardId')
  @ApiOkResponse({ standardSchema: AdminCardSchema })
  update(
    @Param('cardId') cardId: string,
    @Body({ schema: CardUpdateSchema }) input: CardUpdate,
  ): Promise<AdminCard> {
    return this.cards.update(cardId, input);
  }

  @Put(':cardId/image')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @ApiOkResponse({ standardSchema: AdminCardSchema })
  async uploadImage(
    @Param('cardId') cardId: string,
    @Req() request: FastifyRequest,
  ): Promise<AdminCard> {
    const file = await request.file();
    if (!file) throw new BadRequestException('Image file is required.');
    return this.cards.uploadImage(cardId, imageFile(await file.toBuffer(), file.mimetype));
  }

  @Delete(':cardId/image')
  @ApiOkResponse({ standardSchema: AdminCardSchema })
  removeImage(@Param('cardId') cardId: string): Promise<AdminCard> {
    return this.cards.removeImage(cardId);
  }

  @Delete(':cardId')
  @HttpCode(204)
  async remove(@Param('cardId') cardId: string): Promise<void> {
    await this.cards.remove(cardId);
  }
}

async function workbook(request: FastifyRequest): Promise<Buffer> {
  const file = await request.file();
  if (!file) throw new BadRequestException('Workbook file is required.');
  if (file.mimetype !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    throw new BadRequestException('Use an .xlsx workbook.');
  }
  return file.toBuffer();
}
