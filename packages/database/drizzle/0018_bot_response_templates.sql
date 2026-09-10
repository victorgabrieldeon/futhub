CREATE TABLE "bot_response_templates" (
	"key" varchar(80) PRIMARY KEY NOT NULL,
	"template" jsonb NOT NULL
);
--> statement-breakpoint
-- Keep every persisted embed property verbatim; only fill new optional properties.
INSERT INTO "bot_response_templates" ("key", "template")
SELECT 'lucro.success', jsonb_build_object(
  'mode', 'legacy', 'content', '', 'components', '[]'::jsonb,
  'embeds', jsonb_build_array(
    '{"imageUrl":"","thumbnailUrl":"","fields":[]}'::jsonb || COALESCE(
      (SELECT "embed" FROM "command_config" WHERE "command_name" = 'lucro'),
      '{"title":"/lucro","description":"**{message}**\nSaldo: **{balance}**\nXP: **+{xp}** ({xp}/{nextLevelXp})\nN\u00edvel: **{level}**","color":"#2B2D31","footer":"Pr\u00f3ximo lucro: {availableAt}"}'::jsonb
    )
  )
)
ON CONFLICT ("key") DO NOTHING;
