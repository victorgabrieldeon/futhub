import { request } from '@futhub/api-client';
import { adminApiOptions } from '../../api/admin-client';
import { type AiChatState, parseState, record } from './api';

export type HistoryItem = Readonly<{
  id: string;
  title: string;
  provider: 'openai' | 'opencode-go' | 'anthropic';
  model: string | null;
  createdAt: string;
  updatedAt: string;
}>;
export type HistoryPage = Readonly<{
  items: readonly HistoryItem[];
  total: number;
  page: number;
  pageSize: number;
}>;
export type HistoryDetail = HistoryItem & Readonly<{ state: AiChatState }>;

function item(value: unknown): value is HistoryItem {
  return (
    record(value) &&
    typeof value.id === 'string' &&
    !!value.id &&
    typeof value.title === 'string' &&
    (value.provider === 'openai' ||
      value.provider === 'opencode-go' ||
      value.provider === 'anthropic') &&
    (value.model === null || typeof value.model === 'string') &&
    typeof value.createdAt === 'string' &&
    Number.isFinite(Date.parse(value.createdAt)) &&
    typeof value.updatedAt === 'string' &&
    Number.isFinite(Date.parse(value.updatedAt))
  );
}
function integer(value: unknown, min: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min;
}
export async function loadHistory(page: number, signal: AbortSignal): Promise<HistoryPage> {
  const value = await request<unknown>(`/v1/admin/ai/sessions/history?page=${page}`, {
    ...adminApiOptions(),
    signal,
  });
  if (
    !record(value) ||
    !Array.isArray(value.items) ||
    !value.items.every(item) ||
    !integer(value.total, 0) ||
    !integer(value.page, 1) ||
    !integer(value.pageSize, 1)
  )
    throw new Error('Histórico inválido. Tente atualizar a lista.');
  return { items: value.items, total: value.total, page: value.page, pageSize: value.pageSize };
}
export async function loadHistoryDetail(id: string, signal: AbortSignal): Promise<HistoryDetail> {
  const value = await request<unknown>(`/v1/admin/ai/sessions/history/${encodeURIComponent(id)}`, {
    ...adminApiOptions(),
    signal,
  });
  if (!item(value) || !('state' in value) || value.id !== id)
    throw new Error('Conversa salva inválida. Volte à lista e tente novamente.');
  const state = parseState(value.state);
  if (state.id !== id) throw new Error('Conversa salva não corresponde à seleção.');
  return { ...value, state };
}
export async function loadWebCapability(signal: AbortSignal): Promise<boolean> {
  const value = await request<unknown>('/v1/admin/ai/sessions/capabilities', {
    ...adminApiOptions(),
    signal,
  });
  if (!record(value) || typeof value.webSearch !== 'boolean')
    throw new Error('Disponibilidade da consulta web não confirmada.');
  return value.webSearch;
}
