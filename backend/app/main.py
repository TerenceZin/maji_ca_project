from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .database import engine, SessionLocal
from . import models
from .auth import hash_password
from .config import settings
from .routers import ai, auth, catalog, carriers, clients, pieces, plan_files, product_templates, production, quotes, suggestions, suppliers, templates, notifications, pdf
from .scheduler import start_scheduler

models.Base.metadata.create_all(bind=engine)

_is_prod = settings.app_env == "production"
app = FastAPI(
    title="Maji Devis API",
    version="1.0.0",
    docs_url=None if _is_prod else "/docs",
    redoc_url=None if _is_prod else "/redoc",
    openapi_url=None if _is_prod else "/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ai.router)
app.include_router(auth.router)
app.include_router(pieces.router)
app.include_router(plan_files.router)
app.include_router(clients.router)
app.include_router(catalog.router)
app.include_router(suppliers.router)
app.include_router(production.router)
app.include_router(quotes.router)
app.include_router(templates.router)
app.include_router(notifications.router)
app.include_router(pdf.router)
app.include_router(carriers.router)
app.include_router(product_templates.router)
app.include_router(suggestions.router)

start_scheduler()


@app.on_event("startup")
def seed_initial_data():
    db = SessionLocal()
    try:
        db.execute(text("CREATE EXTENSION IF NOT EXISTS unaccent"))
        db.commit()
        _seed_users(db)
        _seed_carriers(db)
        _seed_product_templates(db)
    finally:
        db.close()


def _seed_users(db):
    if db.query(models.User).count() > 0:
        return
    users = [
        models.User(
            email=settings.deviseur_email,
            password_hash=hash_password(settings.deviseur_password),
            name=settings.deviseur_name,
            role="deviseur",
        ),
        models.User(
            email=settings.directeur_email,
            password_hash=hash_password(settings.directeur_password),
            name=settings.directeur_name,
            role="directeur",
        ),
    ]
    db.add_all(users)
    db.commit()


def _seed_carriers(db):
    if db.query(models.Carrier).count() > 0:
        return
    carriers = [
        models.Carrier(
            name="Chronopost",
            service_type="Express",
            tarif_kg=5.50,
            tarif_palette=120.00,
            delai_moyen_j=1,
            zones_geo="France métropolitaine, DOM-TOM, Europe",
        ),
        models.Carrier(
            name="DPD France",
            service_type="Standard",
            tarif_kg=1.20,
            tarif_palette=52.00,
            delai_moyen_j=2,
            zones_geo="France métropolitaine",
        ),
        models.Carrier(
            name="GLS France",
            service_type="Standard",
            tarif_kg=1.10,
            tarif_palette=48.00,
            delai_moyen_j=2,
            zones_geo="France métropolitaine, Europe",
        ),
        models.Carrier(
            name="TNT (FedEx)",
            service_type="Express",
            tarif_kg=4.80,
            tarif_palette=98.00,
            delai_moyen_j=1,
            zones_geo="France métropolitaine, Europe, International",
        ),
        models.Carrier(
            name="Geodis",
            service_type="Économique",
            tarif_kg=0.90,
            tarif_palette=38.00,
            delai_moyen_j=4,
            zones_geo="France métropolitaine, Europe",
        ),
        models.Carrier(
            name="XPO Logistics",
            service_type="Palette",
            tarif_kg=0.85,
            tarif_palette=35.00,
            delai_moyen_j=4,
            zones_geo="France métropolitaine, Europe",
        ),
    ]
    db.add_all(carriers)
    db.commit()


def _seed_product_templates(db):
    if db.query(models.ProductTemplate).count() > 0:
        return
    templates = [
        models.ProductTemplate(
            reference="MAJI-BOI-001",
            name="Boîtier électronique standard",
            description="Boîtier métallique pour équipements électroniques, tôle galvanisée 1mm",
            category="boîtier",
            dimensions_colis="25x18x12",
            poids_emballage_g=400,
            components_data=[
                {"reference": "AM-GALV-DX51-10", "name": "Tôle acier galvanisé DX51D 1.0mm", "supplier": "ArcelorMittal", "quantity": 0.08, "unit": "feuille", "unit_price": 25.50, "total": 2.04, "weight_g": 15700},
                {"reference": "BN 1206", "name": "Vis à tête fraisée M4x12 A2-70", "supplier": "Bossard", "quantity": 8, "unit": "pièce", "unit_price": 0.035, "total": 0.28, "weight_g": 2.8},
                {"reference": "BN 671", "name": "Écrou hexagonal M5 A2-70", "supplier": "Bossard", "quantity": 4, "unit": "pièce", "unit_price": 0.032, "total": 0.128, "weight_g": 2.8},
            ],
            production_data=[
                {"operation_type": "decoupe_laser", "operation_name": "Découpe laser", "machine_name": "LASER-01", "quantity": 1.2, "unit_of_measure": "mètre linéaire", "material": "galvanise", "thickness_mm": 1.0, "complexity_factor": 1.0, "time_min": 5.6, "hourly_cost": 85, "cost": 7.93},
                {"operation_type": "pliage", "operation_name": "Pliage", "machine_name": "PLIE-01", "quantity": 4, "unit_of_measure": "pli", "material": "galvanise", "thickness_mm": 1.0, "complexity_factor": 1.0, "time_min": 8.0, "hourly_cost": 55, "cost": 7.33},
                {"operation_type": "assemblage", "operation_name": "Assemblage vissage", "machine_name": None, "quantity": 8, "unit_of_measure": "point", "material": "galvanise", "thickness_mm": 1.0, "complexity_factor": 1.0, "time_min": 2.4, "hourly_cost": 55, "cost": 2.20},
            ],
        ),
        models.ProductTemplate(
            reference="MAJI-PLA-001",
            name="Platine de fixation murale",
            description="Platine de fixation perforée pour montage mural, acier S235 2mm",
            category="fixation",
            dimensions_colis="40x25x5",
            poids_emballage_g=300,
            components_data=[
                {"reference": "AM-HRC-S235-20", "name": "Tôle acier S235JR laminée à chaud 2.0mm", "supplier": "ArcelorMittal", "quantity": 0.03, "unit": "feuille", "unit_price": 36.40, "total": 1.09, "weight_g": 31400},
                {"reference": "BN 3100", "name": "Cheville à expansion M8 acier zingué", "supplier": "Bossard", "quantity": 4, "unit": "pièce", "unit_price": 0.38, "total": 1.52, "weight_g": 22.0},
            ],
            production_data=[
                {"operation_type": "decoupe_laser", "operation_name": "Découpe laser", "machine_name": "LASER-01", "quantity": 0.8, "unit_of_measure": "mètre linéaire", "material": "acier", "thickness_mm": 2.0, "complexity_factor": 1.0, "time_min": 5.2, "hourly_cost": 85, "cost": 7.37},
                {"operation_type": "pliage", "operation_name": "Pliage", "machine_name": "PLIE-01", "quantity": 2, "unit_of_measure": "pli", "material": "acier", "thickness_mm": 2.0, "complexity_factor": 1.0, "time_min": 3.2, "hourly_cost": 55, "cost": 2.93},
                {"operation_type": "ebavurage", "operation_name": "Ébavurage manuel", "machine_name": None, "quantity": 0.8, "unit_of_measure": "mètre linéaire", "material": "acier", "thickness_mm": 2.0, "complexity_factor": 1.0, "time_min": 1.2, "hourly_cost": 55, "cost": 1.10},
            ],
        ),
        models.ProductTemplate(
            reference="MAJI-RAC-001",
            name="Panneau avant baie 19\" 1U",
            description="Panneau avant pour rack baie 19 pouces 1U, inox 304 1.5mm",
            category="rack",
            dimensions_colis="55x15x5",
            poids_emballage_g=350,
            components_data=[
                {"reference": "AM-INOX-304-15", "name": "Tôle inox 304 2B 1.5mm", "supplier": "ArcelorMittal", "quantity": 0.025, "unit": "feuille", "unit_price": 85.00, "total": 2.125, "weight_g": 23700},
                {"reference": "BN 1207", "name": "Vis CHC M5x16 A2-70", "supplier": "Bossard", "quantity": 8, "unit": "pièce", "unit_price": 0.052, "total": 0.416, "weight_g": 5.1},
            ],
            production_data=[
                {"operation_type": "decoupe_laser", "operation_name": "Découpe laser", "machine_name": "LASER-01", "quantity": 1.4, "unit_of_measure": "mètre linéaire", "material": "inox", "thickness_mm": 1.5, "complexity_factor": 1.0, "time_min": 7.28, "hourly_cost": 85, "cost": 10.31},
                {"operation_type": "pliage", "operation_name": "Pliage", "machine_name": "PLIE-01", "quantity": 2, "unit_of_measure": "pli", "material": "inox", "thickness_mm": 1.5, "complexity_factor": 1.0, "time_min": 3.0, "hourly_cost": 55, "cost": 2.75},
                {"operation_type": "ebavurage", "operation_name": "Ébavurage manuel", "machine_name": None, "quantity": 1.4, "unit_of_measure": "mètre linéaire", "material": "inox", "thickness_mm": 1.5, "complexity_factor": 1.0, "time_min": 2.1, "hourly_cost": 55, "cost": 1.93},
            ],
        ),
        models.ProductTemplate(
            reference="MAJI-CAP-001",
            name="Capot de protection moteur",
            description="Capot de protection pour moteur électrique, aluminium 5754 2mm",
            category="capot",
            dimensions_colis="35x28x18",
            poids_emballage_g=500,
            components_data=[
                {"reference": "AM-ALU-5754-20", "name": "Tôle aluminium 5754 H22 2.0mm", "supplier": "ArcelorMittal", "quantity": 0.05, "unit": "feuille", "unit_price": 45.00, "total": 2.25, "weight_g": 10800},
                {"reference": "BN 1207", "name": "Vis CHC M5x16 A2-70", "supplier": "Bossard", "quantity": 6, "unit": "pièce", "unit_price": 0.052, "total": 0.312, "weight_g": 5.1},
                {"reference": "BN 671", "name": "Écrou hexagonal M5 A2-70", "supplier": "Bossard", "quantity": 6, "unit": "pièce", "unit_price": 0.032, "total": 0.192, "weight_g": 2.8},
            ],
            production_data=[
                {"operation_type": "decoupe_laser", "operation_name": "Découpe laser", "machine_name": "LASER-01", "quantity": 1.6, "unit_of_measure": "mètre linéaire", "material": "alu", "thickness_mm": 2.0, "complexity_factor": 1.0, "time_min": 6.5, "hourly_cost": 85, "cost": 9.21},
                {"operation_type": "pliage", "operation_name": "Pliage", "machine_name": "PLIE-01", "quantity": 5, "unit_of_measure": "pli", "material": "alu", "thickness_mm": 2.0, "complexity_factor": 1.0, "time_min": 8.8, "hourly_cost": 55, "cost": 8.07},
                {"operation_type": "assemblage", "operation_name": "Assemblage vissage", "machine_name": None, "quantity": 6, "unit_of_measure": "point", "material": "alu", "thickness_mm": 2.0, "complexity_factor": 1.0, "time_min": 1.8, "hourly_cost": 55, "cost": 1.65},
            ],
        ),
        models.ProductTemplate(
            reference="MAJI-SUP-001",
            name="Support en U standard",
            description="Support en forme de U pour montage industriel, galvanisé 1.5mm",
            category="support",
            dimensions_colis="30x15x10",
            poids_emballage_g=250,
            components_data=[
                {"reference": "AM-GALV-DX51-15", "name": "Tôle acier galvanisé DX51D 1.5mm", "supplier": "ArcelorMittal", "quantity": 0.02, "unit": "feuille", "unit_price": 37.80, "total": 0.756, "weight_g": 23550},
                {"reference": "BN 1210", "name": "Vis CHC M6x20 A2-70", "supplier": "Bossard", "quantity": 4, "unit": "pièce", "unit_price": 0.068, "total": 0.272, "weight_g": 7.2},
                {"reference": "BN 746", "name": "Rondelle plate M6 A2", "supplier": "Bossard", "quantity": 4, "unit": "pièce", "unit_price": 0.015, "total": 0.06, "weight_g": 2.9},
            ],
            production_data=[
                {"operation_type": "decoupe_laser", "operation_name": "Découpe laser", "machine_name": "LASER-01", "quantity": 0.6, "unit_of_measure": "mètre linéaire", "material": "galvanise", "thickness_mm": 1.5, "complexity_factor": 1.0, "time_min": 3.4, "hourly_cost": 85, "cost": 4.82},
                {"operation_type": "pliage", "operation_name": "Pliage", "machine_name": "PLIE-01", "quantity": 2, "unit_of_measure": "pli", "material": "galvanise", "thickness_mm": 1.5, "complexity_factor": 1.0, "time_min": 3.0, "hourly_cost": 55, "cost": 2.75},
                {"operation_type": "soudure_mig", "operation_name": "Soudure MIG/MAG", "machine_name": None, "quantity": 0.15, "unit_of_measure": "mètre linéaire", "material": "galvanise", "thickness_mm": 1.5, "complexity_factor": 1.0, "time_min": 3.0, "hourly_cost": 65, "cost": 3.25},
            ],
        ),
        models.ProductTemplate(
            reference="MAJI-GRI-001",
            name="Grille de ventilation perforée",
            description="Grille de ventilation perforée pour coffrets et armoires, galvanisé 0.8mm",
            category="ventilation",
            dimensions_colis="25x15x4",
            poids_emballage_g=150,
            components_data=[
                {"reference": "AM-GALV-DX51-08", "name": "Tôle acier galvanisé DX51D 0.8mm", "supplier": "ArcelorMittal", "quantity": 0.015, "unit": "feuille", "unit_price": 21.00, "total": 0.315, "weight_g": 12560},
                {"reference": "BN 84516", "name": "Rivet aveugle 4.0x10 alu/acier", "supplier": "Bossard", "quantity": 6, "unit": "pièce", "unit_price": 0.028, "total": 0.168, "weight_g": 1.2},
            ],
            production_data=[
                {"operation_type": "decoupe_laser", "operation_name": "Découpe laser", "machine_name": "LASER-01", "quantity": 0.5, "unit_of_measure": "mètre linéaire", "material": "galvanise", "thickness_mm": 0.8, "complexity_factor": 1.0, "time_min": 2.4, "hourly_cost": 85, "cost": 3.40},
                {"operation_type": "poinconnage", "operation_name": "Poinçonnage", "machine_name": "POINC-01", "quantity": 48, "unit_of_measure": "coup", "material": "galvanise", "thickness_mm": 0.8, "complexity_factor": 1.0, "time_min": 4.1, "hourly_cost": 65, "cost": 4.44},
                {"operation_type": "ebavurage", "operation_name": "Ébavurage manuel", "machine_name": None, "quantity": 0.5, "unit_of_measure": "mètre linéaire", "material": "galvanise", "thickness_mm": 0.8, "complexity_factor": 1.0, "time_min": 0.75, "hourly_cost": 55, "cost": 0.69},
            ],
        ),
        models.ProductTemplate(
            reference="MAJI-RAC-002",
            name="Châssis rack 19\" 2U",
            description="Châssis rack 19 pouces 2U pour équipements informatiques et industriels, acier DC01 2mm",
            category="rack",
            dimensions_colis="55x30x22",
            poids_emballage_g=800,
            components_data=[
                {"reference": "AM-CRC-DC01-20", "name": "Tôle acier DC01 laminée à froid 2.0mm", "supplier": "ArcelorMittal", "quantity": 0.12, "unit": "feuille", "unit_price": 44.80, "total": 5.376, "weight_g": 31400},
                {"reference": "BN 1210", "name": "Vis CHC M6x20 A2-70", "supplier": "Bossard", "quantity": 12, "unit": "pièce", "unit_price": 0.068, "total": 0.816, "weight_g": 7.2},
                {"reference": "BN 673", "name": "Écrou hexagonal M8 A2-70", "supplier": "Bossard", "quantity": 8, "unit": "pièce", "unit_price": 0.058, "total": 0.464, "weight_g": 6.2},
                {"reference": "BN 20240", "name": "Insert fileté M6 laiton à sertir", "supplier": "Bossard", "quantity": 8, "unit": "pièce", "unit_price": 0.21, "total": 1.68, "weight_g": 6.5},
            ],
            production_data=[
                {"operation_type": "decoupe_laser", "operation_name": "Découpe laser", "machine_name": "LASER-01", "quantity": 3.2, "unit_of_measure": "mètre linéaire", "material": "acier", "thickness_mm": 2.0, "complexity_factor": 1.0, "time_min": 20.0, "hourly_cost": 85, "cost": 28.33},
                {"operation_type": "pliage", "operation_name": "Pliage", "machine_name": "PLIE-01", "quantity": 8, "unit_of_measure": "pli", "material": "acier", "thickness_mm": 2.0, "complexity_factor": 1.0, "time_min": 12.8, "hourly_cost": 55, "cost": 11.73},
                {"operation_type": "soudure_mig", "operation_name": "Soudure MIG/MAG", "machine_name": None, "quantity": 0.4, "unit_of_measure": "mètre linéaire", "material": "acier", "thickness_mm": 2.0, "complexity_factor": 1.0, "time_min": 8.0, "hourly_cost": 65, "cost": 8.67},
                {"operation_type": "peinture", "operation_name": "Peinture", "machine_name": None, "quantity": 0.18, "unit_of_measure": "m²", "material": "acier", "thickness_mm": 2.0, "complexity_factor": 1.0, "time_min": 15.54, "hourly_cost": 45, "cost": 11.66},
            ],
        ),
        models.ProductTemplate(
            reference="MAJI-COF-001",
            name="Couvercle coffret étanche IP65",
            description="Couvercle étanche IP65 pour coffret industriel, inox 304 1.5mm",
            category="coffret",
            dimensions_colis="45x35x6",
            poids_emballage_g=400,
            components_data=[
                {"reference": "AM-INOX-304-15", "name": "Tôle inox 304 2B 1.5mm", "supplier": "ArcelorMittal", "quantity": 0.04, "unit": "feuille", "unit_price": 85.00, "total": 3.40, "weight_g": 23700},
                {"reference": "BN 1207", "name": "Vis CHC M5x16 A2-70", "supplier": "Bossard", "quantity": 8, "unit": "pièce", "unit_price": 0.052, "total": 0.416, "weight_g": 5.1},
                {"reference": "BN 84524", "name": "Rivet aveugle étanche 4.8x10 inox A2", "supplier": "Bossard", "quantity": 4, "unit": "pièce", "unit_price": 0.085, "total": 0.34, "weight_g": 2.1},
            ],
            production_data=[
                {"operation_type": "decoupe_laser", "operation_name": "Découpe laser", "machine_name": "LASER-01", "quantity": 1.6, "unit_of_measure": "mètre linéaire", "material": "inox", "thickness_mm": 1.5, "complexity_factor": 1.0, "time_min": 8.32, "hourly_cost": 85, "cost": 11.79},
                {"operation_type": "pliage", "operation_name": "Pliage", "machine_name": "PLIE-01", "quantity": 2, "unit_of_measure": "pli", "material": "inox", "thickness_mm": 1.5, "complexity_factor": 1.0, "time_min": 3.0, "hourly_cost": 55, "cost": 2.75},
                {"operation_type": "soudure_tig", "operation_name": "Soudure TIG", "machine_name": None, "quantity": 1.2, "unit_of_measure": "mètre linéaire", "material": "inox", "thickness_mm": 1.5, "complexity_factor": 1.0, "time_min": 11.52, "hourly_cost": 70, "cost": 13.44},
                {"operation_type": "ebavurage", "operation_name": "Ébavurage manuel", "machine_name": None, "quantity": 1.6, "unit_of_measure": "mètre linéaire", "material": "inox", "thickness_mm": 1.5, "complexity_factor": 1.0, "time_min": 2.4, "hourly_cost": 55, "cost": 2.20},
            ],
        ),
    ]
    db.add_all(templates)
    db.commit()


@app.get("/api/health")
def health():
    return {"status": "ok"}
