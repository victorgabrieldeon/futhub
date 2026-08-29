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
};
export type PackInput = Omit<Pack, 'id' | 'config'> & { config: Omit<PackConfig, 'id'> };

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
