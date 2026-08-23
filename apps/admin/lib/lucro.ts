export type LucroEmbed = Readonly<{
  title: string;
  description: string;
  color: string;
  footer: string;
}>;

export type CommandSchemaProperty = Readonly<{
  type: string;
  description: string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  examples: string[];
}>;

export type CommandSchemaVariable = Readonly<{
  token: string;
  description: string;
  example: string;
}>;

export type LucroEmbedSchema = Readonly<{
  $schema: string;
  title: string;
  description: string;
  type: string;
  properties: Record<string, CommandSchemaProperty>;
  required: string[];
  additionalProperties: boolean;
  examples: LucroEmbed[];
  variables: CommandSchemaVariable[];
}>;

export type CommandContextProperty = Readonly<{
  type: string;
  description: string;
  format?: string;
  example: string;
}>;

export type LucroCommandContract = Readonly<{
  data: LucroEmbedSchema;
  contexto: Readonly<{
    $schema: string;
    title: string;
    description: string;
    type: string;
    properties: Record<string, CommandContextProperty>;
    required: string[];
    additionalProperties: boolean;
  }>;
  utilities: ReadonlyArray<
    Readonly<{ name: string; signature: string; description: string; example: string }>
  >;
}>;

export type LucroRewardMessages = Readonly<{
  pt: string;
  es: string;
  en: string;
}>;

export type LucroReward = Readonly<{
  id: string;
  value: number;
  weight: number;
  messages: LucroRewardMessages;
}>;

export type LucroConfig = Readonly<{
  cooldownSeconds: number;
  rewards: LucroReward[];
  embed: LucroEmbed;
}>;

export type LucroConfigInput = Readonly<{
  cooldownSeconds: number;
  rewards: Omit<LucroReward, 'id'>[];
  embed: LucroEmbed;
}>;
