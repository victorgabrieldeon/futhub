INSERT INTO "card_market_config" (
  "singleton",
  "sell_multiplier_basis_points",
  "buy_multiplier_basis_points"
) VALUES (true, 2000, 20000)
ON CONFLICT ("singleton") DO NOTHING;--> statement-breakpoint

INSERT INTO "card_price_configs" ("overall", "price")
SELECT "overall", ("overall" - 59) * 25
FROM generate_series(60, 100) AS "overall"
ON CONFLICT ("overall") DO NOTHING;--> statement-breakpoint

INSERT INTO "game_settings" ("singleton", "max_cards_per_user")
VALUES (true, 100)
ON CONFLICT ("singleton") DO NOTHING;
