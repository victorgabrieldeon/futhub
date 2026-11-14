import type { LucroResponse, QueueResponse } from './generated/index.js';

export * from './generated/index.js';
export { ApiClientError, configureApiClient, request, type ApiClientOptions } from './request.js';
export type QueueMatchedResponse = Extract<QueueResponse, { kind: 'matched' }>;
export type QueueWaitingResponse = Extract<QueueResponse, { kind: 'waiting' }>;
export type QueueStatusResponse = QueueResponse | null;
export type QueueMatchedResponseNullable = QueueMatchedResponse | null;
export type QueueWaitingResponseNullable = QueueWaitingResponse | null;
export type LucroCooldownResponse = Extract<LucroResponse, { kind: 'cooldown' }>;
export type LucroSuccessResponse = Extract<LucroResponse, { kind: 'success' }>;
