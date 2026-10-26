-- 001: Başlangıç şeması
-- Migration sisteminden önce açılış kodunun oluşturduğu şemanın aynısıdır. IF NOT EXISTS kullandığı için
-- daha önce oluşturulmuş veritabanlarında hiçbir şeyi değiştirmeden "uygulandı" olarak işaretlenir.

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(100) NULL,
    email VARCHAR(100) UNIQUE NULL,
    password_hash VARCHAR(255) NULL,
    user_type VARCHAR(20) DEFAULT 'guest',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS plants (
    id SERIAL PRIMARY KEY,
    key VARCHAR(50) UNIQUE NOT NULL,
    name_tr VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS diseases (
    id SERIAL PRIMARY KEY,
    plant_id INT REFERENCES plants(id) ON DELETE CASCADE,
    key VARCHAR(100) NOT NULL,
    name_tr VARCHAR(150) NOT NULL,
    name_en VARCHAR(150) NOT NULL,
    treatment_recommendation TEXT NOT NULL,
    UNIQUE (plant_id, key)
);

CREATE TABLE IF NOT EXISTS diagnoses (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    yaprak_guven NUMERIC,
    plant_id INT REFERENCES plants(id),
    bitki_guven NUMERIC,
    disease_id INT REFERENCES diseases(id),
    hastalik_guven NUMERIC,
    hastalik_durum VARCHAR(50),
    resim_yolu VARCHAR(255),
    tedavi_onerisi TEXT,
    tarih TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Çok eski veritabanlarında bu kolon sonradan eklenmişti
ALTER TABLE diagnoses ADD COLUMN IF NOT EXISTS tedavi_onerisi TEXT;

-- Oturum yenileme (refresh) token'ları — token'ın kendisi değil SHA-256 hash'i saklanır
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash CHAR(64) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

-- E-posta aramaları büyük/küçük harf duyarsız yapılır (LOWER(email))
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));
