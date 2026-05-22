# Maji Devis

> Application web interne de création de devis pour le groupe industriel **Maji**, spécialiste de la tôlerie fine.
> Remplace les fichiers Excel manuels utilisés par les deviseurs et instaure un workflow de validation par le directeur.

---

## Sommaire

1. [Contexte](#contexte)
2. [Aperçu](#aperçu)
3. [Stack technique](#stack-technique)
4. [Démarrage rapide (dev)](#démarrage-rapide-dev)
5. [Comptes de démonstration](#comptes-de-démonstration)
6. [Variables d'environnement](#variables-denvironnement)
7. [Architecture](#architecture)
8. [Choix techniques](#choix-techniques)
9. [Workflow métier](#workflow-métier)
10. [Déploiement en production](#déploiement-en-production)
11. [Commandes utiles](#commandes-utiles)
12. [Limites connues et roadmap](#limites-connues-et-roadmap)
13. [Résolution de problèmes](#résolution-de-problèmes)
14. [Licence](#licence)

---

## Contexte

**Maji** est un groupe industriel français de tôlerie fine (découpe laser, pliage, soudure, assemblage). Le processus de devis reposait jusqu'ici sur des **classeurs Excel manuels** dupliqués à chaque demande client : ressaisie des composants, recalcul à la main des temps de production, copier-coller des barèmes machines, génération artisanale du PDF final.

Cette application remplace ce processus par un outil web unifié :

- **catalogue centralisé** des matières (ArcelorMittal) et composants (Bossard), avec mock de refresh prix quotidien
- **éditeur de devis** type tableur (Handsontable) avec calcul automatique du coût matière, production, transport et marge
- **décomposition par IA** : une description libre de pièce est convertie en liste d'opérations standardisées, puis chiffrée via les barèmes machines stockés en base
- **workflow de validation** : tout devis au-delà d'un seuil configurable (10 000 € par défaut) déclenche une notification au directeur pour approbation
- **génération PDF** professionnelle prête à être envoyée au client
- **deux rôles** : `deviseur` (création) et `directeur` (validation + visibilité globale)

---

## Aperçu

> Captures d'écran à ajouter dans `docs/screenshots/` (dashboard, éditeur de devis, PDF généré, écran de validation).

---

## Stack technique

| Couche | Technologie | Version |
|---|---|---|
| **Frontend** | React | 18.3 |
| | TypeScript | 5.6 |
| | Vite | 6.0 |
| | Tailwind CSS | 3.4 |
| | Handsontable | 14.6 |
| | Zustand | 5.0 |
| | React Router | 6.28 |
| | Axios | 1.7 |
| | date-fns | 4.1 |
| | lucide-react | 0.468 |
| | react-hot-toast | 2.4 |
| **Backend** | Python | 3.12 |
| | FastAPI | 0.115 |
| | SQLAlchemy | 2.0 |
| | Alembic | 1.14 *(installé, non utilisé — voir [Limites](#limites-connues-et-roadmap))* |
| | Pydantic | 2.10 |
| | python-jose (JWT) | 3.3 |
| | bcrypt | 4.2 |
| | APScheduler | 3.10 |
| | ReportLab (PDF) | 4.2 |
| | pypdfium2 + Pillow | — |
| | httpx | 0.27 |
| **Base de données** | PostgreSQL | 16 |
| **Conteneurisation** | Docker + Docker Compose | — |
| **Reverse-proxy (prod)** | Caddy | 2 |
| **Serveur statique (prod)** | nginx (image Alpine) | — |
| **IA (optionnel)** | Anthropic Claude API | — |

---

## Démarrage rapide (dev)

### Prérequis

| Outil | Version | Lien |
|---|---|---|
| Docker Desktop | 4.x | https://www.docker.com/products/docker-desktop |
| Git | 2.x | https://git-scm.com/downloads |

> **Windows** : Docker Desktop nécessite WSL 2 (installé automatiquement par Docker Desktop).
> Aucune installation de Python, Node.js ou PostgreSQL en local n'est requise.

### Installation

```bash
# 1. Cloner le dépôt
git clone <url-du-repo>
cd <nom-du-repo>

# 2. Préparer l'environnement
# Windows PowerShell
Copy-Item .env.example .env
# macOS / Linux
cp .env.example .env

# 3. Lancer l'application
docker compose up
```

Le premier démarrage prend **2 à 5 minutes** (téléchargement des images PostgreSQL 16, Python 3.12, Node 20 + build).

### Accès aux services

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| API Backend | http://localhost:8000 |
| Documentation API (Swagger) | http://localhost:8000/docs |
| Base de données | `localhost:5432` (`maji` / `maji_secret`) |

---

## Comptes de démonstration

> ⚠️ Identifiants de démonstration uniquement. **À changer impérativement en production** via les variables d'environnement.

| Rôle | Email | Mot de passe |
|---|---|---|
| Deviseur | `deviseur@maji.fr` | `deviseur123` |
| Directeur | `directeur@maji.fr` | `directeur123` |

---

## Variables d'environnement

Les variables sont définies dans `.env` (dev) ou dans la configuration de déploiement (prod). Toutes ont une valeur par défaut sauf indication contraire.

### Application

| Variable | Défaut | Description |
|---|---|---|
| `APP_ENV` | `development` | Mettre `production` pour désactiver `/docs`, `/redoc` et `/openapi.json` |
| `CORS_ORIGINS` | `*` | Origines autorisées (CSV). **À restreindre en production** au(x) domaine(s) réel(s) |
| `DATABASE_URL` | `postgresql://maji:maji_secret@db:5432/maji` | URL de connexion PostgreSQL |
| `VALIDATION_THRESHOLD` | `10000` | Montant € au-delà duquel un devis nécessite la validation directeur |
| `TVA_RATE` | `0.20` | Taux de TVA appliqué aux devis |

### Authentification

| Variable | Défaut | Description |
|---|---|---|
| `JWT_SECRET` | *(valeur de dev)* | **OBLIGATOIRE en prod**. Générer avec `python -c "import secrets; print(secrets.token_hex(64))"` |
| `JWT_ALGORITHM` | `HS256` | Algorithme de signature JWT |
| `JWT_EXPIRE_MINUTES` | `480` | Durée de vie d'un token (8 h) |

### Comptes initiaux

| Variable | Défaut | Description |
|---|---|---|
| `DEVISEUR_EMAIL` | `deviseur@maji.fr` | Email du compte deviseur seedé au 1er démarrage |
| `DEVISEUR_PASSWORD` | `deviseur123` | Mot de passe |
| `DEVISEUR_NAME` | `Deviseur` | Nom affiché |
| `DIRECTEUR_EMAIL` | `directeur@maji.fr` | Email du compte directeur |
| `DIRECTEUR_PASSWORD` | `directeur123` | Mot de passe |
| `DIRECTEUR_NAME` | `Directeur` | Nom affiché |

### IA (optionnel)

| Variable | Défaut | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-dummy` | Si absente ou égale à `sk-ant-dummy`, le **mode mock** est activé (aucun appel API réel) |

### SMTP (optionnel, requis pour l'envoi de devis par email)

| Variable | Défaut | Description |
|---|---|---|
| `SMTP_HOST` | *(vide)* | Si vide, l'envoi d'email est désactivé |
| `SMTP_PORT` | `587` | |
| `SMTP_USER` | *(vide)* | |
| `SMTP_PASSWORD` | *(vide)* | Exemple Gmail : utiliser un **App Password**, pas le mot de passe principal |
| `SMTP_FROM` | `devis@maji.fr` | Adresse expéditeur |
| `SMTP_TLS` | `true` | |

### Production uniquement

| Variable | Description |
|---|---|
| `DB_PASSWORD` | Mot de passe PostgreSQL (référencé par `DATABASE_URL`) |
| `DOMAIN` | Nom de domaine public (ex. `devis.maji.fr`) |
| `IMAGE` | Préfixe d'image Docker (registry + namespace) pour `docker-compose.prod.yml` |

Voir [`.env.prod.example`](.env.prod.example) pour le détail.

---

## Architecture

### Vue d'ensemble

```
                  ┌─────────────────────────────────────┐
                  │            Navigateur               │
                  └──────────────┬──────────────────────┘
                                 │ HTTPS (prod) / HTTP (dev)
                                 ▼
              ┌──────────────────────────────────┐
   prod →     │   Caddy (reverse-proxy, :8741)   │
              │  /api/* → backend  /* → frontend │
              └────────┬─────────────────┬───────┘
                       │                 │
              ┌────────▼─────┐   ┌───────▼────────┐
              │   FastAPI    │   │   Frontend     │
              │   :8000      │   │ React+Vite     │
              │              │   │ (nginx en prod)│
              │ - JWT/bcrypt │   └────────────────┘
              │ - SQLAlchemy │
              │ - APScheduler│ ──► refresh prix quotidien 06h
              │ - ReportLab  │
              │ - Anthropic  │ ──► (optionnel) décomposition IA
              └──────┬───────┘
                     │
              ┌──────▼───────┐
              │ PostgreSQL16 │
              │ + unaccent   │
              └──────────────┘
```

### Arborescence

```
.
├── docker-compose.yml            # Orchestration dev (hot-reload, bind-mount)
├── docker-compose.prod.yml       # Orchestration prod (images pré-buildées + Caddy)
├── Caddyfile                     # Reverse-proxy production
├── .env.example                  # Template config dev
├── .env.prod.example             # Template config prod
│
├── backend/                      # API FastAPI (Python 3.12)
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py               # Entrée + CORS + routes + seed initial
│       ├── auth.py               # JWT + bcrypt
│       ├── models.py             # SQLAlchemy ORM
│       ├── database.py           # Connexion PostgreSQL
│       ├── config.py             # Settings via pydantic-settings
│       ├── scheduler.py          # APScheduler (refresh prix 06h00)
│       ├── email_service.py      # Envoi SMTP
│       ├── routers/
│       │   ├── auth.py           # POST /api/auth/token
│       │   ├── quotes.py         # CRUD devis + submit + validate
│       │   ├── clients.py        # CRUD clients
│       │   ├── catalog.py        # Catalogue matières/composants
│       │   ├── suppliers.py      # Mock Bossard + ArcelorMittal
│       │   ├── carriers.py       # Transporteurs
│       │   ├── production.py     # Barèmes + calcul temps/coût
│       │   ├── templates.py      # Templates de devis (client)
│       │   ├── product_templates.py  # Templates produit standardisés
│       │   ├── pieces.py         # Gestion des pièces
│       │   ├── plan_files.py     # Fichiers de plans (uploads)
│       │   ├── ai.py             # Décomposition pièce → opérations (LLM)
│       │   ├── pdf.py            # Génération PDF ReportLab
│       │   ├── suggestions.py    # Suggestions auto
│       │   └── notifications.py
│       └── services/
│           ├── supplier_sync.py  # refresh_prices() — simulation ±3 %
│           └── production.py     # Calculs barèmes
│
├── frontend/                     # React 18 + Vite + TypeScript
│   ├── Dockerfile                # Dev (Vite + HMR)
│   ├── Dockerfile.prod           # Prod (build + nginx Alpine)
│   ├── nginx.conf                # Conf nginx prod
│   ├── package.json
│   └── src/
│       ├── App.tsx               # Router React
│       ├── api.ts                # Axios + intercepteur JWT
│       ├── store/auth.ts         # Zustand — état authentification
│       ├── types/index.ts        # Types TypeScript partagés
│       ├── utils/                # Helpers (formatage, calculs)
│       ├── pages/                # 11 pages applicatives
│       └── components/
│           ├── layout/           # Sidebar + Layout principal
│           ├── quote/            # Éditeur de devis
│           ├── piece/            # Visualisation pièce
│           ├── clients/          # Composants clients
│           └── ui/               # Composants génériques
│
└── db/
    └── init.sql                  # Schéma + seed (matières ArcelorMittal,
                                  # composants Bossard, barèmes machines)
```

---

## Choix techniques

### Backend

- **FastAPI** — typage natif Pydantic, OpenAPI/Swagger générés automatiquement (utile pour la revue), support async pour les appels Anthropic et SMTP non bloquants.
- **SQLAlchemy 2.0** — ORM mature, support type hints modernes, requêtes complexes (jointures catalogue/devis/utilisateurs).
- **PostgreSQL 16** — extension `unaccent` activée pour la recherche client/composant tolérante aux accents, colonnes `JSONB` pour stocker les snapshots de barèmes et templates produit.
- **APScheduler** plutôt qu'un cron externe — un seul conteneur backend, simulation pragmatique du refresh fournisseur quotidien.
- **ReportLab** — génération PDF côté serveur, mise en page précise, pas de dépendance navigateur (LaTeX/headless Chrome écartés).
- **python-jose + bcrypt** — JWT stateless adapté à un usage interne deux rôles. Sessions configurées sur 8 h.

### Frontend

- **Vite** — HMR rapide, build optimisé, configuration minimale.
- **Handsontable** — le besoin métier est l'édition tabulaire type Excel (le deviseur connaît déjà Excel). Les alternatives type AG Grid étaient soit trop lourdes, soit trop limitées sur l'édition inline. *Voir [Limites](#limites-connues-et-roadmap) concernant la licence.*
- **Zustand** plutôt que Redux — état d'authentification + quelques flags UI, Redux serait surdimensionné. API hooks-friendly, 1 ko, pas de boilerplate.
- **Tailwind** — itération rapide sur le design system, classes utilitaires plutôt qu'une lib de composants imposée.
- **Axios** avec intercepteur JWT — injection automatique du token, refresh trivial à brancher plus tard.

### Infrastructure

- **Docker Compose** — un `docker compose up` suffit à démarrer le stack complet, indispensable pour la portabilité et l'onboarding d'un nouveau développeur.
- **Caddy en production** plutôt que nginx — HTTPS automatique (Let's Encrypt), configuration Caddyfile 10 lignes vs 50 pour un équivalent nginx, healthchecks intégrés.
- **Frontend servi par nginx en prod** (build statique) — pas de Vite dev server en prod, image finale légère (~25 Mo).

---

## Workflow métier

```
┌─────────┐     ┌────────────┐     ┌────────────┐     ┌─────────────┐     ┌─────────┐
│Brouillon│ ──► │ Soumis     │ ──► │ Validé     │ ──► │ Envoyé      │ ──► │ Accepté │
│         │     │ (si > seuil│     │ ou Refusé  │     │ au client   │     │ ou Perdu│
│         │     │  10 000 €) │     │ (directeur)│     │ (PDF email) │     │         │
└─────────┘     └────────────┘     └────────────┘     └─────────────┘     └─────────┘
```

- Tout devis sous le seuil de validation peut être envoyé directement par le deviseur.
- Au-delà, soumission → notification directeur → approbation / refus avec commentaire.
- Le snapshot des prix matière et barèmes machines est **figé** au moment de la création du devis (pas de recalcul rétroactif si les prix bougent ensuite).

---

## Déploiement en production

### Préparation

```bash
cp .env.prod.example .env

# Générer un JWT_SECRET fort
python -c "import secrets; print(secrets.token_hex(64))"

# Éditer .env :
# - DOMAIN, DB_PASSWORD, JWT_SECRET, CORS_ORIGINS=https://<domaine>
# - APP_ENV=production  (désactive Swagger et la doc OpenAPI)
# - DEVISEUR_PASSWORD / DIRECTEUR_PASSWORD (mots de passe forts)
# - IMAGE=<registry>/<namespace>  (préfixe des images publiées)
```

### Déploiement

```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Caddy expose l'application sur le port `8741` (mappable au 443 selon votre infra) et route automatiquement `/api/*` vers le backend, le reste vers le frontend statique servi par nginx.

### Sécurité prod : checklist

- [ ] `APP_ENV=production` (désactive `/docs`, `/redoc`, `/openapi.json`)
- [ ] `JWT_SECRET` généré aléatoirement (64+ caractères)
- [ ] `CORS_ORIGINS` restreint au(x) domaine(s) réel(s)
- [ ] Mots de passe deviseur/directeur changés
- [ ] `DB_PASSWORD` aléatoire et différent du défaut
- [ ] Port PostgreSQL **non exposé** publiquement
- [ ] Sauvegardes PostgreSQL automatisées (hors scope de ce repo)

---

## Commandes utiles

```bash
# Démarrer en arrière-plan
docker compose up -d

# Logs temps réel (tous services ou un seul)
docker compose logs -f
docker compose logs -f backend

# Arrêter
docker compose down

# Arrêter + supprimer le volume PostgreSQL (reset complet)
docker compose down -v

# Rebuild après modification d'un Dockerfile / requirements
docker compose up --build

# Shell dans un conteneur
docker compose exec backend bash
docker compose exec db psql -U maji
```

---

## Limites connues et roadmap

Connues et assumées :

- **Aucun test automatisé** côté backend ou frontend. À introduire avant industrialisation : `pytest` + `httpx` pour l'API, `vitest` + Testing Library côté React.
- **Alembic est installé mais non utilisé** — le schéma est créé via `Base.metadata.create_all()` au démarrage. À basculer sur Alembic dès qu'il faudra gérer des migrations en production.
- **Mocks fournisseurs** — les API Bossard et ArcelorMittal sont simulées (35 et 28 références en seed, refresh ±3 % aléatoire). L'intégration aux vraies API est à brancher dans `services/supplier_sync.py`.
- **Mode IA mock par défaut** — sans `ANTHROPIC_API_KEY`, la décomposition retourne des opérations factices déterministes. Acceptable pour démo, à activer pour usage réel.
- **`CREATE EXTENSION unaccent`** est exécuté au boot applicatif plutôt que dans `init.sql` — à déplacer.
- **Endpoint `@app.on_event("startup")`** déprécié par FastAPI ≥ 0.93, à migrer vers le `lifespan` context manager.
- **Licence Handsontable** — Handsontable est sous licence non-libre au-delà de l'usage non-commercial. À valider juridiquement pour un usage interne Maji (alternative : AG Grid Community ou Handsontable Pro).
- **Pas de rate-limiting** sur l'API (login, endpoint IA notamment).
- **Pas de mécanisme de refresh token** — l'utilisateur doit se reconnecter au bout de 8 h.

---

## Résolution de problèmes

**Les conteneurs ne démarrent pas**
→ Vérifier que Docker Desktop tourne (icône barre système).

**Port 3000 ou 8000 déjà occupé**
→ Modifier les ports dans `docker-compose.yml` (`"3001:3000"` par exemple).

**Base de données vide / corrompue**
→ `docker compose down -v && docker compose up`

**Erreur de connexion backend depuis le frontend**
→ Vérifier `VITE_API_URL=http://localhost:8000` dans `docker-compose.yml`.

**Windows — erreur WSL 2**
→ PowerShell administrateur : `wsl --install`, puis redémarrer.

**L'IA renvoie toujours les mêmes opérations**
→ `ANTHROPIC_API_KEY` absente ou égale à `sk-ant-dummy` : mode mock actif. Renseigner une vraie clé pour activer l'API.

---

## Licence

Propriétaire — © Terence Tresch. Tous droits réservés.

Ce repository est publié à des fins de revue d'ingénierie. Toute réutilisation, redistribution ou modification est soumise à autorisation préalable.
