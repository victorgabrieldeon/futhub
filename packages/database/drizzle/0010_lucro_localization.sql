ALTER TABLE "command_config" ADD COLUMN IF NOT EXISTS "embed" jsonb NOT NULL DEFAULT '{"title":"/lucro","description":"**{message}**\\nSaldo: **{balance}**\\nXP: **+{xp}** ({xp}/{nextLevelXp})\\nNível: **{level}**","color":"#2B2D31","footer":"Próximo lucro: {availableAt}"}'::jsonb;
ALTER TABLE "command_reward" ADD COLUMN IF NOT EXISTS "message" text;
ALTER TABLE "command_reward" ADD COLUMN IF NOT EXISTS "messages" jsonb NOT NULL DEFAULT '{}'::jsonb;
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_name = 'command_reward' AND column_name = 'message_text_id'
  ) THEN
    UPDATE "command_reward" AS reward
    SET "message" = COALESCE(
      (
        SELECT translation."content"
        FROM "localized_text_translations" AS translation
        WHERE translation."localized_text_id" = reward."message_text_id" AND translation."locale" IN ('pt', 'pt-BR')
        ORDER BY translation."locale" = 'pt' DESC
        LIMIT 1
      ),
      ''
    );
    UPDATE "command_reward" AS reward
    SET "messages" = jsonb_build_object(
      'pt', COALESCE((SELECT "content" FROM "localized_text_translations" WHERE "localized_text_id" = reward."message_text_id" AND "locale" IN ('pt', 'pt-BR') ORDER BY "locale" = 'pt' DESC LIMIT 1), reward."message"),
      'es', COALESCE((SELECT "content" FROM "localized_text_translations" WHERE "localized_text_id" = reward."message_text_id" AND "locale" = 'es' LIMIT 1), reward."message"),
      'en', COALESCE((SELECT "content" FROM "localized_text_translations" WHERE "localized_text_id" = reward."message_text_id" AND "locale" = 'en' LIMIT 1), reward."message")
    );
  ELSE
    UPDATE "command_reward" SET "messages" = jsonb_build_object('pt', "message", 'es', "message", 'en', "message");
  END IF;
END $$;
ALTER TABLE "command_reward" ALTER COLUMN "message" SET NOT NULL;
ALTER TABLE "command_config" ALTER COLUMN "embed" DROP DEFAULT;
ALTER TABLE "command_reward" ALTER COLUMN "messages" DROP DEFAULT;
