-- Lëk database schema
-- PostgreSQL

-- 1. counties
CREATE TABLE counties (
    id                SERIAL PRIMARY KEY,
    name              VARCHAR(100) NOT NULL,
    region            VARCHAR(100),
    lean_season_start INTEGER CHECK (lean_season_start BETWEEN 1 AND 12),
    lean_season_end   INTEGER CHECK (lean_season_end BETWEEN 1 AND 12)
);

-- 2. users
CREATE TABLE users (
    id                  SERIAL PRIMARY KEY,
    phone_number        VARCHAR(20) UNIQUE NOT NULL,
    county_id           INTEGER REFERENCES counties(id),
    language_preference VARCHAR(10) DEFAULT 'en',
    status              VARCHAR(15) DEFAULT 'active',
    registered_at       TIMESTAMP DEFAULT NOW()
);

-- 3. admin_users
CREATE TABLE admin_users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20),
    created_at    TIMESTAMP DEFAULT NOW()
);

-- 4. model_versions
CREATE TABLE model_versions (
    id           SERIAL PRIMARY KEY,
    version_name VARCHAR(100) UNIQUE NOT NULL,
    trained_at   TIMESTAMP,
    rmse         DECIMAL,
    mape         DECIMAL,
    r2_score     DECIMAL,
    is_active    BOOLEAN DEFAULT FALSE
);

-- 5. predictions
CREATE TABLE predictions (
    id                   SERIAL PRIMARY KEY,
    county_id            INTEGER REFERENCES counties(id),
    model_version_id     INTEGER REFERENCES model_versions(id),
    predicted_price      DECIMAL,
    predicted_change_pct DECIMAL,
    prediction_date      DATE,
    target_date          DATE
);

-- 6. alerts
CREATE TABLE alerts (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER REFERENCES users(id),
    prediction_id   INTEGER REFERENCES predictions(id),
    message_text    TEXT,
    channel         VARCHAR(10),
    delivery_status VARCHAR(15),
    sent_at         TIMESTAMP
);

-- 7. thresholds
CREATE TABLE thresholds (
    id           SERIAL PRIMARY KEY,
    county_id    INTEGER REFERENCES counties(id),
    danger_level DECIMAL,
    severe_level DECIMAL,
    updated_by   INTEGER REFERENCES admin_users(id),
    updated_at   TIMESTAMP DEFAULT NOW()
);

-- Indexes on foreign keys and frequently queried columns
CREATE INDEX idx_users_county_id            ON users(county_id);
CREATE INDEX idx_users_phone_number         ON users(phone_number);
CREATE INDEX idx_predictions_county_id      ON predictions(county_id);
CREATE INDEX idx_predictions_model_version  ON predictions(model_version_id);
CREATE INDEX idx_predictions_prediction_date ON predictions(prediction_date);
CREATE INDEX idx_predictions_target_date    ON predictions(target_date);
CREATE INDEX idx_alerts_user_id             ON alerts(user_id);
CREATE INDEX idx_alerts_prediction_id       ON alerts(prediction_id);
CREATE INDEX idx_thresholds_county_id       ON thresholds(county_id);
CREATE INDEX idx_thresholds_updated_by      ON thresholds(updated_by);
