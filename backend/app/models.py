from sqlalchemy import (Boolean, Column, Date, Float, ForeignKey, Integer,
                        LargeBinary, Numeric, String, Text, TIMESTAMP, func)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from .database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(Text, nullable=False)
    name = Column(String(255), nullable=False)
    role = Column(String(50), default="deviseur")
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class Client(Base):
    __tablename__ = "clients"
    id = Column(Integer, primary_key=True)
    company_name = Column(String(255), nullable=False)
    address = Column(Text)
    contact_name = Column(String(255))
    contact_email = Column(String(255))
    phone = Column(String(50))
    siret = Column(String(20))
    payment_terms = Column(String(255), default="30 jours net")
    default_discount = Column(Numeric(5, 2), default=0)
    target_margin = Column(Numeric(5, 2), default=30)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    quotes = relationship("Quote", back_populates="client")


class CatalogItem(Base):
    __tablename__ = "catalog"
    id = Column(Integer, primary_key=True)
    reference = Column(String(100), unique=True, nullable=False)
    name = Column(Text, nullable=False)
    category = Column(String(50), nullable=False)
    supplier = Column(String(100), nullable=False)
    unit_price = Column(Numeric(12, 4), nullable=False)
    unit = Column(String(50), default="pièce")
    weight_g = Column(Numeric(10, 2))
    thickness_mm = Column(Numeric(5, 2))
    moq = Column(Integer, default=1)
    last_updated = Column(TIMESTAMP(timezone=True), server_default=func.now())
    price_change_flag = Column(Boolean, default=False)
    price_change_percent = Column(Numeric(6, 2), default=0)
    previous_price = Column(Numeric(12, 4))


class Operation(Base):
    __tablename__ = "operations"
    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    operation_type = Column(String(100), nullable=False)
    unit_of_measure = Column(String(100))
    base_time_min = Column(Numeric(8, 4), nullable=False)
    setup_time_min = Column(Numeric(8, 2), default=0)
    coeff_acier = Column(Numeric(5, 3), default=1.0)
    coeff_inox = Column(Numeric(5, 3), default=1.0)
    coeff_alu = Column(Numeric(5, 3), default=1.0)
    coeff_galvanise = Column(Numeric(5, 3), default=1.0)
    coeff_ep_05 = Column(Numeric(5, 3), default=1.0)
    coeff_ep_08 = Column(Numeric(5, 3), default=1.0)
    coeff_ep_10 = Column(Numeric(5, 3), default=1.0)
    coeff_ep_15 = Column(Numeric(5, 3), default=1.0)
    coeff_ep_20 = Column(Numeric(5, 3), default=1.0)
    coeff_ep_25 = Column(Numeric(5, 3), default=1.0)
    coeff_ep_30 = Column(Numeric(5, 3), default=1.0)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class Machine(Base):
    __tablename__ = "machines"
    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    machine_type = Column(String(255))
    operation_type = Column(String(100))
    hourly_cost = Column(Numeric(8, 2), nullable=False)
    status = Column(String(50), default="actif")
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    queue = relationship("ProductionQueue", back_populates="machine")


class ProductionQueue(Base):
    __tablename__ = "production_queue"
    id = Column(Integer, primary_key=True)
    command_reference = Column(String(100), nullable=False)
    machine_id = Column(Integer, ForeignKey("machines.id"))
    estimated_time_min = Column(Numeric(8, 2))
    remaining_time_min = Column(Numeric(8, 2))
    status = Column(String(50), default="en_attente")
    scheduled_start = Column(TIMESTAMP(timezone=True))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    machine = relationship("Machine", back_populates="queue")


class PlanFile(Base):
    """Fichier plan (PDF ou image) stocké en base pour une pièce ou un template."""
    __tablename__ = "plan_files"
    id = Column(Integer, primary_key=True)
    filename = Column(String(255), nullable=False)
    mime_type = Column(String(100), nullable=False)  # application/pdf, image/png, image/jpeg…
    data = Column(LargeBinary, nullable=False)        # contenu brut
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class Piece(Base):
    """Géométrie complète d'une pièce — source de vérité du devis."""
    __tablename__ = "pieces"
    id = Column(Integer, primary_key=True)
    # Identification
    reference = Column(String(100))
    designation = Column(String(255))
    client_id = Column(Integer, ForeignKey("clients.id"))
    quote_id = Column(Integer, ForeignKey("quotes.id"), nullable=True)
    plan_file_id = Column(Integer, ForeignKey("plan_files.id"), nullable=True)
    # Matière & Traitement
    matiere = Column(String(50))      # acier, inox, alu, galvanise
    nuance = Column(String(100))      # S235JR, 304, 5754…
    epaisseur_mm = Column(Numeric(6, 2))
    traitement = Column(String(100))  # zingage, peinture, passivation…
    # Dimensions & Masse
    longueur_mm = Column(Numeric(10, 2))
    largeur_mm = Column(Numeric(10, 2))
    hauteur_mm = Column(Numeric(10, 2))
    surface_dev_m2 = Column(Numeric(12, 8))
    longueur_decoupe_mm = Column(Numeric(10, 2))
    volume_mm3 = Column(Numeric(14, 2))
    masse_g = Column(Numeric(10, 2))
    # Notes & Tolérances
    tolerances = Column(String(255))  # ISO 2768 -m
    notes = Column(Text)
    # Timestamps
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    # Relations
    trous = relationship("Trou", back_populates="piece", cascade="all, delete-orphan")
    plis = relationship("Pli", back_populates="piece", cascade="all, delete-orphan")
    plan_file = relationship("PlanFile")


class Trou(Base):
    """Trou ou découpe d'une pièce (section 4 du devis)."""
    __tablename__ = "trous"
    id = Column(Integer, primary_key=True)
    piece_id = Column(Integer, ForeignKey("pieces.id", ondelete="CASCADE"), nullable=False)
    forme = Column(String(50), nullable=False)     # circulaire, carré, rectangulaire, ovale
    diametre_mm = Column(Numeric(8, 3))            # pour les formes circulaires / ovales
    largeur_mm = Column(Numeric(8, 3))             # pour carré / rectangulaire
    hauteur_mm = Column(Numeric(8, 3))             # pour carré / rectangulaire
    quantite = Column(Integer, default=1, nullable=False)
    piece = relationship("Piece", back_populates="trous")


class Pli(Base):
    """Pli d'une pièce (section 5 du devis)."""
    __tablename__ = "plis"
    id = Column(Integer, primary_key=True)
    piece_id = Column(Integer, ForeignKey("pieces.id", ondelete="CASCADE"), nullable=False)
    angle_deg = Column(Numeric(6, 2))
    rayon_mm = Column(Numeric(8, 3))
    longueur_mm = Column(Numeric(10, 2))
    quantite = Column(Integer, default=1, nullable=False)
    piece = relationship("Piece", back_populates="plis")


class Template(Base):
    __tablename__ = "templates"
    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id"))
    data = Column(JSONB, default={})
    plan_file_id = Column(Integer, ForeignKey("plan_files.id"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    last_used_at = Column(TIMESTAMP(timezone=True))
    usage_count = Column(Integer, default=0)
    client = relationship("Client")
    plan_file = relationship("PlanFile")


class Quote(Base):
    __tablename__ = "quotes"
    id = Column(Integer, primary_key=True)
    reference = Column(String(100), unique=True, nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id"))
    status = Column(String(50), default="draft")
    data = Column(JSONB, default={})
    margin_percent = Column(Numeric(5, 2), default=30)
    total_ht = Column(Numeric(14, 2), default=0)
    total_ttc = Column(Numeric(14, 2), default=0)
    estimated_delivery_date = Column(Date)
    validation_comment = Column(Text)
    validated_by = Column(Integer, ForeignKey("users.id"))
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    client = relationship("Client", back_populates="quotes")


class QuoteVersion(Base):
    __tablename__ = "quotes_versions"
    id = Column(Integer, primary_key=True)
    quote_id = Column(Integer, ForeignKey("quotes.id", ondelete="CASCADE"))
    version_number = Column(Integer, nullable=False)
    data = Column(JSONB, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class CatalogRequest(Base):
    __tablename__ = "catalog_requests"
    id = Column(Integer, primary_key=True)
    requested_by = Column(Integer, ForeignKey("users.id"))
    description = Column(Text, nullable=False)
    supplier = Column(String(100))
    status = Column(String(50), default="pending")
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String(255), nullable=False)
    body = Column(Text)
    read = Column(Boolean, default=False)
    quote_id = Column(Integer, ForeignKey("quotes.id"))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class Carrier(Base):
    __tablename__ = "carriers"
    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    service_type = Column(String(100), nullable=False)
    tarif_kg = Column(Numeric(8, 2), nullable=False)
    tarif_palette = Column(Numeric(8, 2), nullable=False)
    delai_moyen_j = Column(Integer, nullable=False)
    zones_geo = Column(String(255), nullable=False)
    active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class ProductTemplate(Base):
    __tablename__ = "product_templates"
    id = Column(Integer, primary_key=True)
    reference = Column(String(100), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    category = Column(String(100))
    components_data = Column(JSONB, default=[])
    production_data = Column(JSONB, default=[])
    dimensions_colis = Column(String(100), default="")
    poids_emballage_g = Column(Integer, default=0)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
