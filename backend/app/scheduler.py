"""APScheduler — daily price refresh."""
from apscheduler.schedulers.background import BackgroundScheduler


def _run_refresh():
    from .database import SessionLocal
    from .services.supplier_sync import refresh_prices
    db = SessionLocal()
    try:
        updated = refresh_prices(db)
        print(f"[scheduler] Refresh catalogue: {updated} articles mis à jour")
    finally:
        db.close()


def start_scheduler():
    scheduler = BackgroundScheduler()
    scheduler.add_job(_run_refresh, "cron", hour=6, minute=0, id="daily_refresh")
    scheduler.start()
