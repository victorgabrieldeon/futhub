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
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
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
  @ApiOperation({
    operationId: 'getAdminCardCatalog',
    summary: 'Lê Times e Coleções para os formulários de card',
  })
  @ApiOkResponse({ standardSchema: CardCatalogSchema })
  catalog(): Promise<CardCatalog> {
    return this.cards.catalog();
  }

  @Get('team-logo-suggestions')
  @ApiOperation({ operationId: 'listTeamLogoSuggestions', summary: 'Sugere escudos para um Time' })
  @ApiOkResponse({ standardSchema: z.array(TeamLogoSuggestionSchema) })
  teamLogoSuggestions(
    @Query({ schema: TeamLogoSuggestionsQuerySchema }) query: TeamLogoSuggestionsQuery,
  ): Promise<TeamLogoSuggestion[]> {
    return this.cards.teamLogoSuggestions(query.q);
  }

  @Get('team-logo-details')
  @ApiOperation({
    operationId: 'getTeamLogoDetails',
    summary: 'Lê os detalhes de um escudo sugerido',
  })
  @ApiOkResponse({ standardSchema: TeamLogoDetailsSchema })
  teamLogoDetails(
    @Query({ schema: TeamLogoDetailsQuerySchema }) query: TeamLogoDetailsQuery,
  ): Promise<TeamLogoDetails> {
    return this.cards.teamLogoDetails(query.slug);
  }

  @Get('team-logos/:filename')
  @ApiOperation({ operationId: 'getTeamLogo', summary: 'Baixa um escudo sugerido' })
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
  @ApiOperation({
    operationId: 'listCollectionArtworkSuggestions',
    summary: 'Sugere artes para uma Coleção',
  })
  @ApiOkResponse({ standardSchema: z.array(CollectionArtworkSuggestionSchema) })
  collectionArtworkSuggestions(
    @Query({ schema: CollectionArtworkSuggestionsQuerySchema })
    query: CollectionArtworkSuggestionsQuery,
  ): Promise<CollectionArtworkSuggestion[]> {
    return this.cards.collectionArtworkSuggestions(query.q);
  }

  @Get('player-photo-suggestions')
  @ApiOperation({
    operationId: 'listPlayerPhotoSuggestions',
    summary: 'Sugere fotos para um jogador',
  })
  @ApiOkResponse({ standardSchema: z.array(PlayerPhotoSuggestionSchema) })
  playerPhotoSuggestions(
    @Query({ schema: PlayerPhotoSuggestionsQuerySchema }) query: PlayerPhotoSuggestionsQuery,
  ): Promise<PlayerPhotoSuggestion[]> {
    return this.cards.playerPhotoSuggestions(query.q);
  }

  @Get('player-photos/:filename')
  @ApiOperation({ operationId: 'getPlayerPhoto', summary: 'Baixa uma foto de jogador sugerida' })
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
  @ApiOperation({
    operationId: 'getPlayerPhotoByKind',
    summary: 'Baixa uma foto de jogador sugerida por tipo',
  })
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
  @ApiOperation({
    operationId: 'listSquadImportClubs',
    summary: 'Busca clubes para importar elenco',
  })
  @ApiOkResponse({ standardSchema: z.array(SquadImportClubSchema) })
  squadImportClubs(
    @Query({ schema: SquadImportClubsQuerySchema }) query: SquadImportClubsQuery,
  ): Promise<SquadImportClub[]> {
    return this.squadImport.clubs(query.q);
  }

  @Get('squad-import/leagues')
  @ApiOperation({
    operationId: 'listSquadImportLeagues',
    summary: 'Lista ligas disponíveis para importar elenco',
  })
  @ApiOkResponse({ standardSchema: z.array(SquadImportLeagueSchema) })
  squadImportLeagues(): Promise<SquadImportLeague[]> {
    return this.squadImport.leagues();
  }

  @Get('squad-import/league-clubs')
  @ApiOperation({
    operationId: 'listSquadImportLeagueClubs',
    summary: 'Lista os clubes de uma liga para importar elenco',
  })
  @ApiOkResponse({ standardSchema: z.array(SquadImportClubSchema) })
  squadImportLeagueClubs(
    @Query({ schema: SquadImportLeagueClubsQuerySchema }) query: SquadImportLeagueClubsQuery,
  ): Promise<SquadImportClub[]> {
    return this.squadImport.leagueClubs(query.leagueId);
  }

  @Get('squad-import/squad')
  @ApiOperation({
    operationId: 'getSquadImportSquad',
    summary: 'Lê o elenco de um clube para importação',
  })
  @ApiOkResponse({ standardSchema: SquadImportPreviewSchema })
  squadImportSquad(
    @Query({ schema: SquadImportSquadQuerySchema }) query: SquadImportSquadQuery,
  ): Promise<SquadImportPreview> {
    return this.squadImport.squad(query);
  }

  @Post('squad-import')
  @ApiOperation({ operationId: 'importSquad', summary: 'Importa o elenco de um clube como Cards' })
  @HttpCode(200)
  @ApiOkResponse({ standardSchema: SquadImportResultSchema })
  importSquad(
    @Body({ schema: SquadImportInputSchema }) input: SquadImportInput,
  ): Promise<SquadImportResult> {
    return this.squadImport.import(input);
  }

  @Get('collections')
  @ApiOperation({ operationId: 'listAdminCollections', summary: 'Lista Coleções' })
  @ApiOkResponse({ standardSchema: CollectionPageSchema })
  collections(
    @Query({ schema: CollectionListQuerySchema }) query: CollectionListQuery,
  ): Promise<CollectionPage> {
    return this.cards.collections(query);
  }

  @Post('collections')
  @ApiOperation({ operationId: 'createAdminCollection', summary: 'Cria uma Coleção' })
  @ApiCreatedResponse({ standardSchema: AdminCollectionSchema })
  createCollection(
    @Body({ schema: CollectionInputSchema }) input: CollectionInput,
  ): Promise<AdminCollection> {
    return this.cards.createCollection(input);
  }

  @Put('collections/:collectionId')
  @ApiOperation({ operationId: 'updateAdminCollection', summary: 'Atualiza uma Coleção' })
  @ApiOkResponse({ standardSchema: AdminCollectionSchema })
  updateCollection(
    @Param('collectionId') collectionId: string,
    @Body({ schema: CollectionInputSchema }) input: CollectionInput,
  ): Promise<AdminCollection> {
    return this.cards.updateCollection(collectionId, input);
  }

  @Delete('collections/:collectionId')
  @ApiOperation({ operationId: 'deleteAdminCollection', summary: 'Remove uma Coleção' })
  @HttpCode(204)
  async removeCollection(@Param('collectionId') collectionId: string): Promise<void> {
    await this.cards.removeCollection(collectionId);
  }

  @Get('teams')
  @ApiOperation({ operationId: 'listAdminTeams', summary: 'Lista Times' })
  @ApiOkResponse({ standardSchema: TeamPageSchema })
  teams(@Query({ schema: TeamListQuerySchema }) query: TeamListQuery): Promise<TeamPage> {
    return this.cards.teams(query);
  }

  @Post('teams')
  @ApiOperation({ operationId: 'createAdminTeam', summary: 'Cria um Time' })
  @ApiCreatedResponse({ standardSchema: AdminTeamSchema })
  createTeam(@Body({ schema: TeamInputSchema }) input: TeamInput): Promise<AdminTeam> {
    return this.cards.createTeam(input);
  }

  @Put('teams/:teamId')
  @ApiOperation({ operationId: 'updateAdminTeam', summary: 'Atualiza um Time' })
  @ApiOkResponse({ standardSchema: AdminTeamSchema })
  updateTeam(
    @Param('teamId') teamId: string,
    @Body({ schema: TeamInputSchema }) input: TeamInput,
  ): Promise<AdminTeam> {
    return this.cards.updateTeam(teamId, input);
  }

  @Delete('teams/:teamId')
  @ApiOperation({ operationId: 'deleteAdminTeam', summary: 'Remove um Time' })
  @HttpCode(204)
  async removeTeam(@Param('teamId') teamId: string): Promise<void> {
    await this.cards.removeTeam(teamId);
  }

  @Get('template')
  @ApiOperation({
    operationId: 'downloadCardImportTemplate',
    summary: 'Baixa a planilha modelo de importação de Cards',
  })
  @ApiOkResponse({ standardSchema: CardTemplateSchema })
  async template(): Promise<CardTemplate> {
    return {
      filename: 'futhub-cards.xlsx',
      content: (await this.cards.template()).toString('base64'),
    };
  }

  @Post('preview')
  @ApiOperation({
    operationId: 'previewCardImport',
    summary: 'Valida uma planilha de Cards sem importar',
  })
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
  @ApiOperation({ operationId: 'importCards', summary: 'Importa Cards de uma planilha' })
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
  @ApiOperation({ operationId: 'listAdminCards', summary: 'Lista Cards' })
  @ApiOkResponse({ standardSchema: CardPageSchema })
  list(@Query({ schema: CardListQuerySchema }) query: CardListQuery): Promise<CardPage> {
    return this.cards.list(query);
  }

  @Post()
  @ApiOperation({ operationId: 'createAdminCard', summary: 'Cria um Card' })
  @ApiCreatedResponse({ standardSchema: AdminCardSchema })
  create(@Body({ schema: CardInputSchema }) input: CardInput): Promise<AdminCard> {
    return this.cards.create(input);
  }

  @Get(':cardId')
  @ApiOperation({ operationId: 'getAdminCard', summary: 'Lê um Card' })
  @ApiOkResponse({ standardSchema: AdminCardSchema })
  get(@Param('cardId') cardId: string): Promise<AdminCard> {
    return this.cards.get(cardId);
  }

  @Put(':cardId')
  @ApiOperation({ operationId: 'updateAdminCard', summary: 'Atualiza um Card' })
  @ApiOkResponse({ standardSchema: AdminCardSchema })
  update(
    @Param('cardId') cardId: string,
    @Body({ schema: CardUpdateSchema }) input: CardUpdate,
  ): Promise<AdminCard> {
    return this.cards.update(cardId, input);
  }

  @Put(':cardId/image')
  @ApiOperation({ operationId: 'uploadAdminCardImage', summary: 'Envia a imagem de um Card' })
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
  @ApiOperation({ operationId: 'deleteAdminCardImage', summary: 'Remove a imagem de um Card' })
  @ApiOkResponse({ standardSchema: AdminCardSchema })
  removeImage(@Param('cardId') cardId: string): Promise<AdminCard> {
    return this.cards.removeImage(cardId);
  }

  @Delete(':cardId')
  @ApiOperation({ operationId: 'deleteAdminCard', summary: 'Remove um Card' })
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
