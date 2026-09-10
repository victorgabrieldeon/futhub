export type LucroRewardMessages = Readonly<{ pt: string; es: string; en: string }>;

export type LucroReward = Readonly<{
  id: string;
  value: number;
  weight: number;
  messages: LucroRewardMessages;
}>;

export type LucroEmbed = Readonly<{
  title: string;
  description: string;
  color: string;
  footer: string;
}>;

export type LucroConfig = Readonly<{
  cooldownSeconds: number;
  rewards: readonly LucroReward[];
  embed: LucroEmbed;
}>;

export type LucroConfigInput = Readonly<{
  cooldownSeconds: number;
  rewards: ReadonlyArray<Omit<LucroReward, 'id'>>;
  embed: LucroEmbed;
}>;

export type LucroEmbedSchema = Readonly<{
  description: string;
  variables: ReadonlyArray<Readonly<{ token: string; description: string; example: string }>>;
  properties: Record<
    keyof LucroEmbed,
    Readonly<{ maxLength: number; examples: readonly string[] }>
  >;
}>;
