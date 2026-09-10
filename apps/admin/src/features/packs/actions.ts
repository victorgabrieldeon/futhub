import { request } from '@futhub/api-client';
import { adminApiOptions } from '../../api/admin-client';

export type PackConfig = {
  id: string;
  name: string | null;
  minOverall: number;
  maxOverall: number;
  onlyPositions: string[];
  excludedPositions: string[];
  onlyCollectionIds: string[];
  excludedCollectionIds: string[];
  onlyCardIds: string[];
  excludedCardIds: string[];
  onlyTeamIds: string[];
  excludedTeamIds: string[];
};
export type PackPresentation = {
  schemaVersion: 1;
  color: string;
  accentColor: string;
  textColor: string;
  effect: 'foil' | 'holographic' | 'chrome';
  texture: 'none' | 'aura' | 'fire' | 'lightning';
  textureOpacity: number;
  tintOpacity: number;
  headline: string;
  headlineSize: number;
  headlineX: number;
  headlineY: number;
  kicker: string;
  kickerX: number;
  kickerY: number;
};
export type Pack = {
  id: string;
  name: string;
  imageUrl: string | null;
  color: string;
  emoji: string;
  cardsAmount: number;
  price: number;
  canBuy: boolean;
  limitPerUser: number;
  config: PackConfig;
  presentation: PackPresentation | null;
};
export type PackInput = Omit<Pack, 'id' | 'config' | 'presentation'> & {
  config: Omit<PackConfig, 'id'>;
  presentation?: PackPresentation;
};

function call<T>(path: string, init?: RequestInit): Promise<T> {
  adminApiOptions();
  return request<T>(path, init ?? {});
}
export const listPacks = () => call<Pack[]>('/v1/admin/packs');
export const createPack = (body: PackInput) =>
  call<Pack>('/v1/admin/packs', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
export const updatePack = (id: string, body: PackInput) =>
  call<Pack>(`/v1/admin/packs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
export const uploadPackImage = (id: string, body: FormData) =>
  call<Pack>(`/v1/admin/packs/${id}/image`, { method: 'PUT', body });
export const disablePack = (id: string) =>
  call<Pack>(`/v1/admin/packs/${id}`, { method: 'DELETE' });
