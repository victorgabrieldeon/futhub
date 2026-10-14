import type * as Generated from './generated.js';

export * from './generated.js';
export {
  autoSelectTeamLineup,
  getClub,
  getTeam,
  setTeamCaptain,
  setTeamFormation,
  setTeamLineupCard,
  setTeamTactic,
  toggleTeamCardFavorite,
  upgradeStadium,
} from './generated.js';
export type {
  GetTeamBodyPosition,
  GetTeamBodySort,
  TeamCard,
  TeamResponse,
} from './generated.js';
export { ApiClientError, configureApiClient, request, type ApiClientOptions } from './request.js';
export type DiscordIdentityDto = Generated.ExecuteLucroBody;
export type ClubEconomyResponse = Generated.GetClub200;
export type BotResponseDefinitionDto = Generated.BotResponseDefinitionDto;
export type BotResponseTemplateDto = Generated.BotResponseTemplateDto;
export type LeagueStatusResponse = Generated.GetV1LeagueDiscordUserId200;
export type PackCatalogItem = Generated.ListPackCatalog200Item;
export type LucroConfigInputDto = Generated.PutV1AdminLucroBody;
export type MatchResponse = Generated.GetV1MatchesMatchId200;
export type MissionDtoCadence = Generated.ListMissions200MissionsItemCadence;
export type MissionsResponse = Generated.ListMissions200;
export type CompletedMissionDto = Generated.PurchasePack200CompletedMissionsItem;
export type AdminMission = Generated.GetV1AdminMissions200Item;
export type AdminMissionInput = Generated.PostV1AdminMissionsBody;
export type AdminMissionOptions = Generated.GetV1AdminMissionsOptions200;
export type OpenPackResponse = Generated.OpenPack200;
export type PurchaseCardResponse = Generated.PurchaseCard200;
export type PurchasePackResponse = Generated.PurchasePack200;
export type PlayerPhotoSuggestion = Generated.GetV1AdminCardsPlayerPhotoSuggestions200Item;
export type QueueResponse = Generated.JoinRankedQueue200;
export type RedeemCodeResponse = Generated.RedeemCode200;
export type AdminRedeemCode = Generated.GetV1AdminRedeemCodes200Item;
export type AdminRedeemCodeInput = Generated.PostV1AdminRedeemCodesBody;
export type AdminRedeemCodeOptions = Generated.GetV1AdminRedeemCodesOptions200;
export type AdminUserPage = Generated.GetV1AdminUsers200;
export type AdminUserSummary = Generated.GetV1AdminUsers200ItemsItem;
export type AdminUserDetail = Generated.GetV1AdminUsersId200;
export type AdminUserProfileInput = Generated.PutV1AdminUsersIdBody;
export type AdminUserOptions = Generated.GetV1AdminUsersOptions200;
export type QueueMatchedResponse = Extract<QueueResponse, { kind: 'matched' }>;
export type QueueWaitingResponse = Extract<QueueResponse, { kind: 'waiting' }>;
export type QueueStatusResponse = Generated.GetV1RankedStatusDiscordUserId200;
export type QueueMatchedResponseNullable = Extract<QueueStatusResponse, { kind: 'matched' }> | null;
export type QueueWaitingResponseNullable = Extract<QueueStatusResponse, { kind: 'waiting' }> | null;
export type SellCardsResponse = Generated.SellCards200;
export type LucroResponse = Generated.ExecuteLucro200;
export type LucroCooldownResponse = Extract<LucroResponse, { kind: 'cooldown' }>;
export type LucroSuccessResponse = Extract<LucroResponse, { kind: 'success' }>;
