-- =============================================================
--  Maji — Script d'initialisation PostgreSQL
-- =============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------
-- USERS
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id          SERIAL PRIMARY KEY,
    email       VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name        VARCHAR(255) NOT NULL,
    role        VARCHAR(50) NOT NULL DEFAULT 'deviseur' CHECK (role IN ('deviseur','directeur')),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------
-- CLIENTS
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clients (
    id              SERIAL PRIMARY KEY,
    company_name    VARCHAR(255) NOT NULL,
    address         TEXT,
    contact_name    VARCHAR(255),
    contact_email   VARCHAR(255),
    phone           VARCHAR(50),
    siret           VARCHAR(20),
    payment_terms   VARCHAR(255) DEFAULT '30 jours net',
    default_discount NUMERIC(5,2) DEFAULT 0,
    target_margin   NUMERIC(5,2) DEFAULT 30,
    created_by      INT REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------
-- CATALOGUE
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS catalog (
    id                  SERIAL PRIMARY KEY,
    reference           VARCHAR(100) UNIQUE NOT NULL,
    name                TEXT NOT NULL,
    category            VARCHAR(50) NOT NULL CHECK (category IN ('composant','matiere_premiere')),
    supplier            VARCHAR(100) NOT NULL,
    unit_price          NUMERIC(12,4) NOT NULL,
    unit                VARCHAR(50) DEFAULT 'pièce',
    weight_g            NUMERIC(10,2),
    thickness_mm        NUMERIC(5,2),
    moq                 INT DEFAULT 1,
    last_updated        TIMESTAMPTZ DEFAULT NOW(),
    price_change_flag   BOOLEAN DEFAULT FALSE,
    price_change_percent NUMERIC(6,2) DEFAULT 0,
    previous_price      NUMERIC(12,4)
);

-- ---------------------------------------------------------------
-- OPERATIONS (barèmes)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS operations (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    operation_type  VARCHAR(100) NOT NULL,
    unit_of_measure VARCHAR(100),
    base_time_min   NUMERIC(8,4) NOT NULL,
    setup_time_min  NUMERIC(8,2) DEFAULT 0,
    coeff_acier     NUMERIC(5,3) DEFAULT 1.0,
    coeff_inox      NUMERIC(5,3) DEFAULT 1.0,
    coeff_alu       NUMERIC(5,3) DEFAULT 1.0,
    coeff_galvanise NUMERIC(5,3) DEFAULT 1.0,
    coeff_ep_05     NUMERIC(5,3) DEFAULT 1.0,
    coeff_ep_08     NUMERIC(5,3) DEFAULT 1.0,
    coeff_ep_10     NUMERIC(5,3) DEFAULT 1.0,
    coeff_ep_15     NUMERIC(5,3) DEFAULT 1.0,
    coeff_ep_20     NUMERIC(5,3) DEFAULT 1.0,
    coeff_ep_25     NUMERIC(5,3) DEFAULT 1.0,
    coeff_ep_30     NUMERIC(5,3) DEFAULT 1.0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------
-- MACHINES
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS machines (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    machine_type    VARCHAR(255),
    operation_type  VARCHAR(100),
    hourly_cost     NUMERIC(8,2) NOT NULL,
    status          VARCHAR(50) DEFAULT 'actif' CHECK (status IN ('actif','maintenance','inactif')),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------
-- PRODUCTION QUEUE
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS production_queue (
    id                  SERIAL PRIMARY KEY,
    command_reference   VARCHAR(100) NOT NULL,
    machine_id          INT REFERENCES machines(id),
    estimated_time_min  NUMERIC(8,2),
    remaining_time_min  NUMERIC(8,2),
    status              VARCHAR(50) DEFAULT 'en_attente' CHECK (status IN ('en_attente','en_cours','termine')),
    scheduled_start     TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------
-- PLAN FILES
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plan_files (
    id          SERIAL PRIMARY KEY,
    filename    VARCHAR(255) NOT NULL,
    mime_type   VARCHAR(100) NOT NULL,
    data        BYTEA NOT NULL,
    created_by  INT REFERENCES users(id),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------
-- TEMPLATES
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS templates (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    type        VARCHAR(50) NOT NULL CHECK (type IN ('client','product','combined')),
    client_id   INT REFERENCES clients(id),
    data        JSONB NOT NULL DEFAULT '{}',
    plan_file_id INT REFERENCES plan_files(id),
    created_by  INT REFERENCES users(id),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    usage_count INT DEFAULT 0
);

-- ---------------------------------------------------------------
-- QUOTES
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quotes (
    id                      SERIAL PRIMARY KEY,
    reference               VARCHAR(100) UNIQUE NOT NULL,
    client_id               INT REFERENCES clients(id),
    status                  VARCHAR(50) DEFAULT 'draft'
                                CHECK (status IN ('draft','submitted','validated','refused','sent','accepted','refused_client')),
    data                    JSONB NOT NULL DEFAULT '{}',
    margin_percent          NUMERIC(5,2) DEFAULT 30,
    total_ht                NUMERIC(14,2) DEFAULT 0,
    total_ttc               NUMERIC(14,2) DEFAULT 0,
    estimated_delivery_date DATE,
    validation_comment      TEXT,
    validated_by            INT REFERENCES users(id),
    created_by              INT REFERENCES users(id),
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------
-- QUOTES VERSIONS
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quotes_versions (
    id              SERIAL PRIMARY KEY,
    quote_id        INT REFERENCES quotes(id) ON DELETE CASCADE,
    version_number  INT NOT NULL,
    data            JSONB NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------
-- CATALOG REQUESTS
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS catalog_requests (
    id              SERIAL PRIMARY KEY,
    requested_by    INT REFERENCES users(id),
    description     TEXT NOT NULL,
    supplier        VARCHAR(100),
    status          VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------
-- NOTIFICATIONS
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id          SERIAL PRIMARY KEY,
    user_id     INT REFERENCES users(id),
    title       VARCHAR(255) NOT NULL,
    body        TEXT,
    read        BOOLEAN DEFAULT FALSE,
    quote_id    INT REFERENCES quotes(id),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
--  SEED DATA
-- =============================================================

-- Les comptes utilisateurs sont créés au démarrage du backend (main.py _seed_users)
-- à partir des variables d'environnement DEVISEUR_* et DIRECTEUR_*

-- Clients de démonstration
INSERT INTO clients (company_name, address, contact_name, contact_email, phone, siret, payment_terms, default_discount, target_margin) VALUES
  ('Industrie Renault SAS',   '92100 Boulogne-Billancourt', 'Pierre Leroux',  'pierre.leroux@renault.fr',   '01 76 84 00 00', '44440045100016', '45 jours fin de mois', 5, 25),
  ('Schneider Electric',      '38050 Grenoble',             'Claire Moreau',  'c.moreau@schneider.com',     '04 76 57 60 60', '54205118200013', '30 jours net',         3, 28),
  ('Safran SA',               '75724 Paris Cedex 15',       'Thomas Richard', 't.richard@safran-group.com', '01 40 60 80 80', '56211003900019', '60 jours net',         0, 30),
  ('Fives Group',             '75008 Paris',                'Sophie Petit',   's.petit@fivesgroup.com',     '01 57 27 08 00', '96720542200014', '30 jours net',         2, 27)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------
-- CATALOGUE — Bossard (composants)
-- ---------------------------------------------------------------
INSERT INTO catalog (reference, name, category, supplier, unit_price, unit, weight_g, moq) VALUES
  ('BN 1206',  'Vis à tête fraisée DIN 965 M4x12 A2-70',         'composant', 'Bossard', 0.035,  'pièce', 2.8,  100),
  ('BN 670',   'Écrou hexagonal DIN 934 M6 A2-70',                'composant', 'Bossard', 0.042,  'pièce', 3.5,  100),
  ('BN 84516', 'Rivet aveugle DIN 7337 4.0x10 alu/acier',         'composant', 'Bossard', 0.028,  'pièce', 1.2,  500),
  ('BN 672',   'Rondelle plate DIN 125 M8 A2',                    'composant', 'Bossard', 0.018,  'pièce', 4.0,  200),
  ('BN 20233', 'Insert fileté M5 acier zingué',                   'composant', 'Bossard', 0.150,  'pièce', 5.0,  50),
  ('BN 10620', 'Vis autoperceuse DIN 7504 4.8x19 A2',             'composant', 'Bossard', 0.065,  'pièce', 4.2,  200),
  ('BN 1207',  'Vis CHC DIN 912 M5x16 A2-70',                     'composant', 'Bossard', 0.052,  'pièce', 5.1,  100),
  ('BN 5765',  'Goupille cylindrique DIN 7 6x30 acier',           'composant', 'Bossard', 0.120,  'pièce', 6.8,  50),
  ('BN 1210',  'Vis CHC DIN 912 M6x20 A2-70',                     'composant', 'Bossard', 0.068,  'pièce', 7.2,  100),
  ('BN 1215',  'Vis CHC DIN 912 M8x25 A2-70',                     'composant', 'Bossard', 0.095,  'pièce', 12.1, 50),
  ('BN 671',   'Écrou hexagonal DIN 934 M5 A2-70',                'composant', 'Bossard', 0.032,  'pièce', 2.8,  200),
  ('BN 673',   'Écrou hexagonal DIN 934 M8 A2-70',                'composant', 'Bossard', 0.058,  'pièce', 6.2,  100),
  ('BN 675',   'Écrou auto-freinant DIN 985 M6 A2',               'composant', 'Bossard', 0.055,  'pièce', 4.1,  100),
  ('BN 676',   'Écrou auto-freinant DIN 985 M8 A2',               'composant', 'Bossard', 0.078,  'pièce', 7.5,  100),
  ('BN 744',   'Rondelle plate DIN 125 M5 A2',                    'composant', 'Bossard', 0.012,  'pièce', 1.8,  500),
  ('BN 746',   'Rondelle plate DIN 125 M6 A2',                    'composant', 'Bossard', 0.015,  'pièce', 2.9,  500),
  ('BN 748',   'Rondelle plate DIN 125 M10 A2',                   'composant', 'Bossard', 0.025,  'pièce', 7.5,  200),
  ('BN 750',   'Rondelle Grower DIN 127 M6 acier zingué',         'composant', 'Bossard', 0.010,  'pièce', 1.4,  500),
  ('BN 84520', 'Rivet aveugle DIN 7337 4.8x12 alu/acier',         'composant', 'Bossard', 0.035,  'pièce', 1.8,  500),
  ('BN 84524', 'Rivet aveugle étanche 4.8x10 inox A2',            'composant', 'Bossard', 0.085,  'pièce', 2.1,  200),
  ('BN 20240', 'Insert fileté M6 laiton à sertir',                'composant', 'Bossard', 0.210,  'pièce', 6.5,  50),
  ('BN 20245', 'Insert fileté M8 acier zingué',                   'composant', 'Bossard', 0.280,  'pièce', 9.2,  25),
  ('BN 1300',  'Vis TF DIN 965 M3x8 A2-70',                       'composant', 'Bossard', 0.022,  'pièce', 1.1,  200),
  ('BN 1302',  'Vis TF DIN 965 M3x12 A2-70',                      'composant', 'Bossard', 0.025,  'pièce', 1.4,  200),
  ('BN 1305',  'Vis TF DIN 965 M4x16 A2-70',                      'composant', 'Bossard', 0.040,  'pièce', 3.2,  100),
  ('BN 5760',  'Goupille élastique DIN 1481 4x20 acier',          'composant', 'Bossard', 0.055,  'pièce', 3.0,  100),
  ('BN 5770',  'Goupille fendue DIN 94 3.2x25 acier zingué',      'composant', 'Bossard', 0.018,  'pièce', 1.5,  200),
  ('BN 8010',  'Entretoise M4 L=10mm laiton',                     'composant', 'Bossard', 0.180,  'pièce', 3.8,  50),
  ('BN 8015',  'Entretoise M5 L=15mm laiton',                     'composant', 'Bossard', 0.240,  'pièce', 6.2,  25),
  ('BN 8020',  'Entretoise M6 L=20mm acier zingué',               'composant', 'Bossard', 0.320,  'pièce', 9.5,  25),
  ('BN 9100',  'Gaine thermorétractable 4mm noire (m)',            'composant', 'Bossard', 0.150,  'mètre', 5.0,  10),
  ('BN 9200',  'Collier de serrage inox 150-170mm',               'composant', 'Bossard', 0.480,  'pièce', 18.0, 10),
  ('BN 3100',  'Cheville à expansion M8 acier zingué',            'composant', 'Bossard', 0.380,  'pièce', 22.0, 25),
  ('BN 3200',  'Cheville chimique M10 résine époxy',              'composant', 'Bossard', 1.200,  'pièce', 35.0, 10),
  ('BN 6100',  'Anneau de levage M10 acier zingué DIN 580',       'composant', 'Bossard', 2.850,  'pièce', 85.0, 5)
ON CONFLICT (reference) DO NOTHING;

-- ---------------------------------------------------------------
-- CATALOGUE — ArcelorMittal (matières premières)
-- ---------------------------------------------------------------
INSERT INTO catalog (reference, name, category, supplier, unit_price, unit, weight_g, thickness_mm, moq) VALUES
  ('AM-HRC-S235-10',  'Tôle acier S235JR laminée à chaud 1.0mm 1000x2000mm',    'matiere_premiere', 'ArcelorMittal', 18.50,  'feuille', 15700, 1.0, 1),
  ('AM-HRC-S235-15',  'Tôle acier S235JR laminée à chaud 1.5mm 1000x2000mm',    'matiere_premiere', 'ArcelorMittal', 27.80,  'feuille', 23550, 1.5, 1),
  ('AM-HRC-S235-20',  'Tôle acier S235JR laminée à chaud 2.0mm 1000x2000mm',    'matiere_premiere', 'ArcelorMittal', 36.40,  'feuille', 31400, 2.0, 1),
  ('AM-HRC-S235-25',  'Tôle acier S235JR laminée à chaud 2.5mm 1000x2000mm',    'matiere_premiere', 'ArcelorMittal', 45.20,  'feuille', 39250, 2.5, 1),
  ('AM-HRC-S235-30',  'Tôle acier S235JR laminée à chaud 3.0mm 1000x2000mm',    'matiere_premiere', 'ArcelorMittal', 54.60,  'feuille', 47100, 3.0, 1),
  ('AM-HRC-S355-15',  'Tôle acier S355JR laminée à chaud 1.5mm 1000x2000mm',    'matiere_premiere', 'ArcelorMittal', 31.20,  'feuille', 23550, 1.5, 1),
  ('AM-HRC-S355-20',  'Tôle acier S355JR laminée à chaud 2.0mm 1000x2000mm',    'matiere_premiere', 'ArcelorMittal', 41.50,  'feuille', 31400, 2.0, 1),
  ('AM-HRC-S355-30',  'Tôle acier S355JR laminée à chaud 3.0mm 1000x2000mm',    'matiere_premiere', 'ArcelorMittal', 61.80,  'feuille', 47100, 3.0, 1),
  ('AM-CRC-DC01-08',  'Tôle acier DC01 laminée à froid 0.8mm 1000x2000mm',      'matiere_premiere', 'ArcelorMittal', 19.60,  'feuille', 12560, 0.8, 1),
  ('AM-CRC-DC01-10',  'Tôle acier DC01 laminée à froid 1.0mm 1000x2000mm',      'matiere_premiere', 'ArcelorMittal', 22.40,  'feuille', 15700, 1.0, 1),
  ('AM-CRC-DC01-15',  'Tôle acier DC01 laminée à froid 1.5mm 1000x2000mm',      'matiere_premiere', 'ArcelorMittal', 33.60,  'feuille', 23550, 1.5, 1),
  ('AM-CRC-DC01-20',  'Tôle acier DC01 laminée à froid 2.0mm 1000x2000mm',      'matiere_premiere', 'ArcelorMittal', 44.80,  'feuille', 31400, 2.0, 1),
  ('AM-INOX-304-10',  'Tôle inox 304 2B 1.0mm 1000x2000mm',                     'matiere_premiere', 'ArcelorMittal', 68.00,  'feuille', 15900, 1.0, 1),
  ('AM-INOX-304-15',  'Tôle inox 304 2B 1.5mm 1000x2000mm',                     'matiere_premiere', 'ArcelorMittal', 85.00,  'feuille', 23700, 1.5, 1),
  ('AM-INOX-304-20',  'Tôle inox 304 2B 2.0mm 1000x2000mm',                     'matiere_premiere', 'ArcelorMittal', 112.00, 'feuille', 31600, 2.0, 1),
  ('AM-INOX-304-30',  'Tôle inox 304 2B 3.0mm 1000x2000mm',                     'matiere_premiere', 'ArcelorMittal', 165.00, 'feuille', 47400, 3.0, 1),
  ('AM-INOX-316-10',  'Tôle inox 316L 2B 1.0mm 1000x2000mm',                    'matiere_premiere', 'ArcelorMittal', 110.00, 'feuille', 15900, 1.0, 1),
  ('AM-INOX-316-15',  'Tôle inox 316L 2B 1.5mm 1000x2000mm',                    'matiere_premiere', 'ArcelorMittal', 138.00, 'feuille', 23700, 1.5, 1),
  ('AM-INOX-316-20',  'Tôle inox 316L 2B 2.0mm 1000x2000mm',                    'matiere_premiere', 'ArcelorMittal', 182.00, 'feuille', 31600, 2.0, 1),
  ('AM-INOX-430-10',  'Tôle inox 430 2B 1.0mm 1000x2000mm',                     'matiere_premiere', 'ArcelorMittal', 52.00,  'feuille', 15800, 1.0, 1),
  ('AM-INOX-430-15',  'Tôle inox 430 2B 1.5mm 1000x2000mm',                     'matiere_premiere', 'ArcelorMittal', 65.00,  'feuille', 23700, 1.5, 1),
  ('AM-ALU-1050-10',  'Tôle aluminium 1050 H14 1.0mm 1000x2000mm',              'matiere_premiere', 'ArcelorMittal', 28.00,  'feuille', 5400,  1.0, 1),
  ('AM-ALU-5754-15',  'Tôle aluminium 5754 H22 1.5mm 1000x2000mm',              'matiere_premiere', 'ArcelorMittal', 36.00,  'feuille', 8100,  1.5, 1),
  ('AM-ALU-5754-20',  'Tôle aluminium 5754 H22 2.0mm 1000x2000mm',              'matiere_premiere', 'ArcelorMittal', 45.00,  'feuille', 10800, 2.0, 1),
  ('AM-ALU-6082-20',  'Tôle aluminium 6082 T6 2.0mm 1000x2000mm',               'matiere_premiere', 'ArcelorMittal', 58.00,  'feuille', 10800, 2.0, 1),
  ('AM-GALV-DX51-08', 'Tôle acier galvanisé DX51D+Z275 0.8mm 1000x2000mm',      'matiere_premiere', 'ArcelorMittal', 21.00,  'feuille', 12560, 0.8, 1),
  ('AM-GALV-DX51-10', 'Tôle acier galvanisé DX51D+Z275 1.0mm 1000x2000mm',      'matiere_premiere', 'ArcelorMittal', 25.50,  'feuille', 15700, 1.0, 1),
  ('AM-GALV-DX51-15', 'Tôle acier galvanisé DX51D+Z275 1.5mm 1000x2000mm',      'matiere_premiere', 'ArcelorMittal', 37.80,  'feuille', 23550, 1.5, 1),
  ('AM-GALV-DX51-20', 'Tôle acier galvanisé DX51D+Z275 2.0mm 1000x2000mm',      'matiere_premiere', 'ArcelorMittal', 49.20,  'feuille', 31400, 2.0, 1)
ON CONFLICT (reference) DO NOTHING;

-- ---------------------------------------------------------------
-- OPERATIONS (barèmes)
-- ---------------------------------------------------------------
INSERT INTO operations (name, operation_type, unit_of_measure, base_time_min, setup_time_min, coeff_acier, coeff_inox, coeff_alu, coeff_galvanise, coeff_ep_05, coeff_ep_08, coeff_ep_10, coeff_ep_15, coeff_ep_20, coeff_ep_25, coeff_ep_30) VALUES
  ('Découpe laser', 'decoupe_laser', 'mètre linéaire', 0.8, 10, 1.0, 1.3, 0.9, 1.0, 0.6, 0.8, 1.0, 1.4, 1.8, 2.3, 2.8),
  ('Poinçonnage',   'poinconnage',   'coup',            0.02, 15, 1.0, 1.2, 0.8, 1.0, 0.6, 0.8, 1.0, 1.4, 1.8, 2.3, 2.8),
  ('Pliage',        'pliage',        'pli',             0.5,  12, 1.0, 1.2, 1.1, 1.0, 0.7, 0.85,1.0, 1.3, 1.6, 1.9, 2.2),
  ('Soudure TIG',   'soudure_tig',   'mètre linéaire',  8.0,  5,  1.0, 1.2, 1.5, 1.0, 0.8, 0.9, 1.0, 1.2, 1.5, 1.65,1.8),
  ('Soudure MIG/MAG','soudure_mig',  'mètre linéaire',  4.0,  5,  1.0, 1.3, 1.6, 1.0, 0.8, 0.9, 1.0, 1.2, 1.5, 1.65,1.8),
  ('Ébavurage manuel','ebavurage',   'mètre linéaire',  1.5,  2,  1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0),
  ('Peinture',      'peinture',      'm²',              3.0,  15, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0),
  ('Zingage',       'zingage',       'lot',             30.0, 0,  1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0),
  ('Assemblage vissage','assemblage','point',           0.3,  3,  1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0),
  ('Assemblage rivetage','assemblage','point',          0.15, 3,  1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------
-- MACHINES
-- ---------------------------------------------------------------
INSERT INTO machines (name, machine_type, operation_type, hourly_cost, status) VALUES
  ('LASER-01',  'Trumpf TruLaser 3030 CO2 4kW',       'decoupe_laser', 85, 'actif'),
  ('LASER-02',  'Bystronic ByStar Fiber 3015 6kW',    'decoupe_laser', 95, 'actif'),
  ('POINC-01',  'Trumpf TruPunch 3000',                'poinconnage',   65, 'actif'),
  ('PLIE-01',   'Trumpf TruBend 5130 130T',            'pliage',        55, 'actif'),
  ('PLIE-02',   'Amada HFE-1003 100T',                 'pliage',        50, 'actif'),
  ('SOUD-01',   'Poste soudure TIG (MO incluse)',      'soudure_tig',   45, 'actif'),
  ('SOUD-02',   'Poste soudure MIG/MAG (MO incluse)', 'soudure_mig',   40, 'actif'),
  ('EBAV-01',   'Ébavureuse automatique',              'ebavurage',     30, 'actif'),
  ('PEINT-01',  'Cabine peinture',                     'peinture',      35, 'actif'),
  ('ASSEMB-01', 'Poste assemblage manuel (MO)',        'assemblage',    35, 'actif')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------
-- PRODUCTION QUEUE (file d'attente simulée)
-- ---------------------------------------------------------------
INSERT INTO production_queue (command_reference, machine_id, estimated_time_min, remaining_time_min, status, scheduled_start) VALUES
  ('CMD-2026-038', (SELECT id FROM machines WHERE name='LASER-01'),  240, 180, 'en_cours',  NOW() - INTERVAL '1 hour'),
  ('CMD-2026-039', (SELECT id FROM machines WHERE name='LASER-02'),  120,  90, 'en_cours',  NOW() - INTERVAL '30 minutes'),
  ('CMD-2026-040', (SELECT id FROM machines WHERE name='PLIE-01'),   180, 120, 'en_attente', NOW() + INTERVAL '3 hours'),
  ('CMD-2026-041', (SELECT id FROM machines WHERE name='SOUD-01'),   300, 240, 'en_attente', NOW() + INTERVAL '4 hours'),
  ('CMD-2026-042', (SELECT id FROM machines WHERE name='PEINT-01'),   90,  60, 'en_cours',  NOW() - INTERVAL '30 minutes')
ON CONFLICT DO NOTHING;
