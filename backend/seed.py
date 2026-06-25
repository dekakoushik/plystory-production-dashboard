import os
from sqlalchemy.orm import Session
from .database import engine, Base, SessionLocal
from .models import User, Setting, TimberPurchase, PeelingProduction, PrePressProduction, HotPressProduction, UploadHistory, AuditLog
from .auth import get_password_hash
from .parsers import parse_timber_purchase, parse_peeling_report, parse_prepress_report, parse_hotpress_report

def seed_db():
    # Create all tables in database
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # Check if users already exist
        if db.query(User).first() is not None:
            print("Database already initialized and seeded.")
            return

        print("Initializing database schema and seeding default records...")
        
        # 1. Create Default Users with hashed passwords
        # Username and password are the same for simplicity in local demo deployment
        users = [
            User(username="admin", password_hash=get_password_hash("admin123"), role="super_admin"),
            User(username="ceo", password_hash=get_password_hash("ceo123"), role="management"),
            User(username="manager", password_hash=get_password_hash("manager123"), role="management"),
            User(username="timber_head", password_hash=get_password_hash("timber123"), role="department_head", department="Timber"),
            User(username="peeling_head", password_hash=get_password_hash("peeling123"), role="department_head", department="Peeling"),
            User(username="prepress_head", password_hash=get_password_hash("prepress123"), role="department_head", department="PrePress"),
            User(username="hotpress_head", password_hash=get_password_hash("hotpress123"), role="department_head", department="HotPress"),
        ]
        db.add_all(users)
        
        # 2. Create Default System Settings
        settings = [
            Setting(key="timber_density", value="800"),  # density in kg/CBM
            Setting(key="glue_consumption_factor", value="0.045"),  # kg of glue per SQFT of prepress
            Setting(key="peeling_target_recovery", value="70.0"),  # target %
            Setting(key="hotpress_target_efficiency", value="85.0"),  # target %
            Setting(key="low_production_threshold", value="5000"),  # low production warning (SQFT)
            Setting(key="high_rejection_threshold", value="5.0"),  # high rejection warning (%)
            Setting(key="missing_upload_days", value="1")  # alert after missing upload days
        ]
        db.add_all(settings)
        
        # 3. Import initial reports if files are present in ./reports
        reports_dir = "./reports"
        
        # Timber Purchase Load
        timber_path = os.path.join(reports_dir, "TIMBERpurchasereport.xls")
        if os.path.exists(timber_path):
            print("Importing Timber Purchase Report...")
            try:
                records = parse_timber_purchase(timber_path)
                db_records = [TimberPurchase(**r, uploaded_by="system") for r in records]
                db.add_all(db_records)
                db.add(UploadHistory(
                    filename="TIMBERpurchasereport.xls",
                    file_type="timber",
                    uploaded_by="system",
                    record_count=len(records),
                    status="Success",
                    logs="System auto-load on setup"
                ))
            except Exception as e:
                print(f"Failed to auto-load timber report: {e}")
                
        # Peeling Load
        peeling_path = os.path.join(reports_dir, "PeelingReport.xls")
        if os.path.exists(peeling_path):
            print("Importing Peeling Production Report...")
            try:
                records = parse_peeling_report(peeling_path)
                db_records = [PeelingProduction(**r, uploaded_by="system") for r in records]
                db.add_all(db_records)
                db.add(UploadHistory(
                    filename="PeelingReport.xls",
                    file_type="peeling",
                    uploaded_by="system",
                    record_count=len(records),
                    status="Success",
                    logs="System auto-load on setup"
                ))
            except Exception as e:
                print(f"Failed to auto-load peeling report: {e}")

        # Prepress Load
        prepress_path = os.path.join(reports_dir, "PREPRESSDatewise (1).xls")
        if os.path.exists(prepress_path):
            print("Importing Pre-Press Production Report...")
            try:
                records = parse_prepress_report(prepress_path)
                db_records = [PrePressProduction(**r, uploaded_by="system") for r in records]
                db.add_all(db_records)
                db.add(UploadHistory(
                    filename="PREPRESSDatewise (1).xls",
                    file_type="prepress",
                    uploaded_by="system",
                    record_count=len(records),
                    status="Success",
                    logs="System auto-load on setup"
                ))
            except Exception as e:
                print(f"Failed to auto-load prepress report: {e}")

        # Hotpress Load
        hotpress_path = os.path.join(reports_dir, "HotPressMatStockReportDatewise.xls")
        if os.path.exists(hotpress_path):
            print("Importing Hot-Press Production Report...")
            try:
                records = parse_hotpress_report(hotpress_path)
                db_records = [HotPressProduction(**r, uploaded_by="system") for r in records]
                db.add_all(db_records)
                db.add(UploadHistory(
                    filename="HotPressMatStockReportDatewise.xls",
                    file_type="hotpress",
                    uploaded_by="system",
                    record_count=len(records),
                    status="Success",
                    logs="System auto-load on setup"
                ))
            except Exception as e:
                print(f"Failed to auto-load hotpress report: {e}")

        # Log system audit entry
        db.add(AuditLog(
            username="system",
            action="System Seeding",
            details="Initial setup: Seeded default users, configuration settings, and imported 4 factory reports."
        ))

        db.commit()
        print("Database schema seeded successfully.")
    except Exception as e:
        db.rollback()
        print(f"Seeding failed: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_db()
