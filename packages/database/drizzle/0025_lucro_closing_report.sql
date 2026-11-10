-- The bot always appended the club closing to the /lucro embed. Templates migrated in 0018
-- lack it, so add the {report} list where an admin has not placed it yet.
UPDATE "bot_response_templates"
SET "template" = jsonb_set(
  "template",
  '{embeds,0,description}',
  to_jsonb(("template" #>> '{embeds,0,description}') || E'\n\n**Fechamento do clube**\n{report}')
)
WHERE "key" = 'lucro.success'
  AND jsonb_typeof("template" -> 'embeds') = 'array'
  AND jsonb_array_length("template" -> 'embeds') > 0
  AND position('{report}' in "template"::text) = 0;
