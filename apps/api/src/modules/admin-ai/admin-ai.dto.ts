import type { tags } from 'typia';

export interface AiSessionInput {
  provider: 'openai' | 'opencode-go' | 'anthropic';
  baseUrl: string & tags.MinLength<1> & tags.MaxLength<2048>;
  apiKey?: string & tags.MinLength<1> & tags.MaxLength<4096>;
}
export interface AiSavedConfig {
  provider: 'openai' | 'opencode-go' | 'anthropic';
  baseUrl: string;
  apiKeyConfigured: boolean;
  models: string[];
  model: string | null;
}
export interface AiPromptInput {
  model: string & tags.MinLength<1> & tags.MaxLength<200>;
  message: string & tags.MinLength<1> & tags.MaxLength<12000>;
}
export interface AiApprovalInput {
  approved: boolean;
}
export type AiMutationName = 'create_team' | 'create_collection' | 'create_card' | 'create_pack';
export interface AiChatAction {
  id: string;
  tool: AiMutationName;
  arguments: string;
  status: 'pending' | 'succeeded' | 'failed' | 'rejected';
  result: string | null;
}
export interface AiChatState {
  id: string;
  models: string[];
  model: string | null;
  notice: string | null;
  messages: { id: string; role: 'user' | 'assistant' | 'tool'; content: string }[];
  actions: AiChatAction[];
}

export interface AiHistoryQuery {
  page?: number & tags.Type<'int32'> & tags.Minimum<1> & tags.Maximum<10000>;
}
export interface AiHistorySummary {
  id: string;
  title: string;
  provider: 'openai' | 'opencode-go' | 'anthropic';
  model: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface AiHistoryPage {
  items: AiHistorySummary[];
  total: number;
  page: number;
  pageSize: number;
}
export interface AiHistoryDetail extends AiHistorySummary {
  state: AiChatState;
}
export type AiStreamEvent =
  | { type: 'done' }
  | { type: 'text'; messageId: string; delta: string }
  | { type: 'state'; state: AiChatState }
  | { type: 'error'; message: string };
export type AiStreamSink = (event: AiStreamEvent) => void;
