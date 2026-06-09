-- Lëk seed data
-- The 10 states of South Sudan as initial county rows.
-- lean_season_start = 5 (May), lean_season_end = 8 (August) for all.

INSERT INTO counties (name, region, lean_season_start, lean_season_end) VALUES
    ('Central Equatoria',        'Equatoria',   5, 8),
    ('Eastern Equatoria',        'Equatoria',   5, 8),
    ('Jonglei',                  'Greater Upper Nile', 5, 8),
    ('Lakes',                    'Bahr el Ghazal',     5, 8),
    ('Northern Bahr el Ghazal',  'Bahr el Ghazal',     5, 8),
    ('Unity',                    'Greater Upper Nile', 5, 8),
    ('Upper Nile',               'Greater Upper Nile', 5, 8),
    ('Warrap',                   'Bahr el Ghazal',     5, 8),
    ('Western Bahr el Ghazal',   'Bahr el Ghazal',     5, 8),
    ('Western Equatoria',        'Equatoria',   5, 8);
