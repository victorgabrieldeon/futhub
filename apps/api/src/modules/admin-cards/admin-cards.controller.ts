import '@fastify/multipart';
import { TypedRoute } from '@nestia/core';
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
import { ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { AdminAuthGuard } from '../auth/admin-auth.guard.js';
import { imageFile } from '../files/files.service.js';
import {
  type AdminCard,
  type AdminCollection,
  type AdminTeam,
  type CardCatalog,
  type CardInput,
  CardInputSchema,
  type CardListQuery,
  CardListQuerySchema,
  type CardPage,
  type CardTemplate,
  type CardUpdate,
  CardUpdateSchema,
  type CollectionArtworkSuggestion,
  type CollectionArtworkSuggestionsQuery,
  CollectionArtworkSuggestionsQuerySchema,
  type CollectionInput,
  CollectionInputSchema,
  type CollectionListQuery,
  CollectionListQuerySchema,
  type CollectionPage,
  type ImportPreview,
  type PlayerPhotoSuggestion,
  type PlayerPhotoSuggestionsQuery,
  PlayerPhotoSuggestionsQuerySchema,
  type TeamInput,
  TeamInputSchema,
  type TeamListQuery,
  TeamListQuerySchema,
  type TeamLogoDetails,
  type TeamLogoDetailsQuery,
  TeamLogoDetailsQuerySchema,
  type TeamLogoSuggestion,
  type TeamLogoSuggestionsQuery,
  TeamLogoSuggestionsQuerySchema,
  type TeamPage,
} from './admin-cards.dto.js';
import { AdminCardsService } from './admin-cards.service.js';

@ApiTags('Administração / Cards')
@Controller('v1/admin/cards')
@UseGuards(AdminAuthGuard)
export class AdminCardsController {
  constructor(@Inject(AdminCardsService) private readonly cards: AdminCardsService) {}

  @TypedRoute.Get('catalog')
  catalog(): Promise<CardCatalog> {
    return this.cards.catalog();
  }

  @TypedRoute.Get('team-logo-suggestions')
  teamLogoSuggestions(
    @Query({ schema: TeamLogoSuggestionsQuerySchema }) query: TeamLogoSuggestionsQuery,
  ): Promise<TeamLogoSuggestion[]> {
    return this.cards.teamLogoSuggestions(query.q);
  }

  @TypedRoute.Get('team-logo-details')
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
  @TypedRoute.Get('collection-artwork-suggestions')
  collectionArtworkSuggestions(
    @Query({ schema: CollectionArtworkSuggestionsQuerySchema })
    query: CollectionArtworkSuggestionsQuery,
  ): Promise<CollectionArtworkSuggestion[]> {
    return this.cards.collectionArtworkSuggestions(query.q);
  }

  @TypedRoute.Get('player-photo-suggestions')
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

  @TypedRoute.Get('collections')
  collections(
    @Query({ schema: CollectionListQuerySchema }) query: CollectionListQuery,
  ): Promise<CollectionPage> {
    return this.cards.collections(query);
  }

  @TypedRoute.Post('collections')
  createCollection(
    @Body({ schema: CollectionInputSchema }) input: CollectionInput,
  ): Promise<AdminCollection> {
    return this.cards.createCollection(input);
  }

  @TypedRoute.Put('collections/:collectionId')
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

  @TypedRoute.Get('teams')
  teams(@Query({ schema: TeamListQuerySchema }) query: TeamListQuery): Promise<TeamPage> {
    return this.cards.teams(query);
  }

  @TypedRoute.Post('teams')
  createTeam(@Body({ schema: TeamInputSchema }) input: TeamInput): Promise<AdminTeam> {
    return this.cards.createTeam(input);
  }

  @TypedRoute.Put('teams/:teamId')
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

  @TypedRoute.Get('template')
  async template(): Promise<CardTemplate> {
    return {
      filename: 'futhub-cards.xlsx',
      content: (await this.cards.template()).toString('base64'),
    };
  }

  @Post('preview')
  @HttpCode(200)
  async preview(@Req() request: FastifyRequest): Promise<ImportPreview> {
    return this.cards.preview(await workbook(request));
  }

  @Post('import')
  @HttpCode(200)
  async import(@Req() request: FastifyRequest): Promise<ImportPreview> {
    return this.cards.import(await workbook(request));
  }

  @TypedRoute.Get()
  list(@Query({ schema: CardListQuerySchema }) query: CardListQuery): Promise<CardPage> {
    return this.cards.list(query);
  }

  @TypedRoute.Post()
  create(@Body({ schema: CardInputSchema }) input: CardInput): Promise<AdminCard> {
    return this.cards.create(input);
  }

  @TypedRoute.Get(':cardId')
  get(@Param('cardId') cardId: string): Promise<AdminCard> {
    return this.cards.get(cardId);
  }

  @TypedRoute.Put(':cardId')
  update(
    @Param('cardId') cardId: string,
    @Body({ schema: CardUpdateSchema }) input: CardUpdate,
  ): Promise<AdminCard> {
    return this.cards.update(cardId, input);
  }

  @Put(':cardId/image')
  async uploadImage(
    @Param('cardId') cardId: string,
    @Req() request: FastifyRequest,
  ): Promise<AdminCard> {
    const file = await request.file();
    if (!file) throw new BadRequestException('Image file is required.');
    return this.cards.uploadImage(cardId, imageFile(await file.toBuffer(), file.mimetype));
  }

  @Delete(':cardId/image')
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
