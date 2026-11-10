-- One-time seed of the global catalog (business rule 5: never re-seed automatically).
-- Runs exactly once via the migration journal. Later catalog changes go through the admin GUI.
-- Content is the MAUI app's former SQLite defaults, translated to Swedish (sv-SE).

INSERT INTO chores (title, description, icon, points, frequency, is_global) VALUES
  ('Diska',                  'Diska all disk i diskhon',                   'dishes',   10, 'daily',  true),
  ('Dammsug vardagsrummet',  'Dammsug golvet i vardagsrummet',             'vacuum',   15, 'weekly', true),
  ('Gå ut med soporna',      'Töm papperskorgarna och gå ut med soporna',  'trash',    10, 'daily',  true),
  ('Tvätta',                 'Tvätta, torka och vik en maskin tvätt',      'laundry',  20, 'weekly', true),
  ('Städa badrummet',        'Skrubba toalett, handfat och dusch',         'bathroom', 25, 'weekly', true),
  ('Klipp gräsmattan',       'Klipp gräsmattan på fram- och baksidan',     'lawn',     30, 'weekly', true),
  ('Mata husdjuren',         'Ge husdjuren mat och vatten',                'pet',       5, 'daily',  true),
  ('Bädda sängen',           'Bädda din säng ordentligt',                  'bed',       5, 'daily',  true);
--> statement-breakpoint

-- "Hoppa över en syssla" had stock 1 in the app's local DB. In a global catalog that would mean
-- one redemption in total across all families, so it is unlimited here (stock NULL).
INSERT INTO rewards (title, description, icon, cost, stock) VALUES
  ('Extra skärmtid',         '30 minuter extra skärmtid',                  'reward_screen',    50, NULL),
  ('Välj middag',            'Bestäm vad det blir till middag ikväll',     'reward_dinner',    75, NULL),
  ('Glassutflykt',           'En tur för att köpa glass',                  'reward_icecream', 100, NULL),
  ('Filmkväll',              'Välj film till familjens filmkväll',         'reward_movie',    150, NULL),
  ('Hoppa över en syssla',   'Hoppa över valfri syssla en gång',           'reward_skip',      80, NULL),
  ('Spelstund',              'En extra timme tv-spel',                     'reward_game',      60, NULL),
  ('Vara uppe längre',       '30 minuter senare läggdags',                 'reward_late',     120, NULL),
  ('Pizzakväll',             'Beställ pizza till middag',                  'reward_pizza',    200, NULL);
--> statement-breakpoint

-- Points achievements use lifetime earned points (business rule 1), not the current balance.
INSERT INTO achievements (code, title, description, icon, rule_type, threshold, bonus_points, rarity) VALUES
  ('first_chore', 'Första steget',  'Gör din första syssla',              'ach_first',    'chores_completed',         1,   5, 'common'),
  ('chores_10',   'På gång',        'Gör 10 sysslor',                     'ach_10',       'chores_completed',        10,  10, 'common'),
  ('chores_50',   'Sysslomästare',  'Gör 50 sysslor',                     'ach_50',       'chores_completed',        50,  25, 'uncommon'),
  ('chores_100',  'Legend',         'Gör 100 sysslor',                    'ach_100',      'chores_completed',       100,  50, 'rare'),
  ('points_100',  'Poängsamlare',   'Tjäna 100 poäng',                    'ach_pts100',   'lifetime_points_earned', 100,  10, 'common'),
  ('points_500',  'Storspelare',    'Tjäna 500 poäng',                    'ach_pts500',   'lifetime_points_earned', 500,  50, 'uncommon'),
  ('streak_3',    'I farten',       'Gör sysslor 3 dagar i rad',          'ach_streak3',  'streak_days',              3,  15, 'common'),
  ('streak_7',    'Ostoppbar',      'Gör sysslor 7 dagar i rad',          'ach_streak7',  'streak_days',              7,  30, 'uncommon'),
  ('streak_30',   'Järnvilja',      'Gör sysslor 30 dagar i rad',         'ach_streak30', 'streak_days',             30, 100, 'legendary'),
  ('spend_100',   'Storshoppare',   'Spendera 100 poäng i butiken',       'ach_spend',    'points_spent',           100,   0, 'common');
