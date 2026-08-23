ALTER TABLE "command_config" ADD COLUMN "embed_title" varchar(256) DEFAULT 'Lucro resgatado' NOT NULL;--> statement-breakpoint
ALTER TABLE "command_config" ADD COLUMN "embed_description" text DEFAULT '{message}

**+{reward} moedas**
Saldo: **{balance}**
XP: **+{xp}** · Nível: **{level}**
Próximo lucro: {availableAt}' NOT NULL;--> statement-breakpoint
ALTER TABLE "command_config" ADD COLUMN "embed_color" varchar(7) DEFAULT '#22c55e' NOT NULL;--> statement-breakpoint
ALTER TABLE "command_config" ADD COLUMN "embed_footer" varchar(2048) DEFAULT 'FutHub' NOT NULL;