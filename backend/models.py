from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Text
from sqlalchemy.sql import func
from .database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False)  # super_admin, management, department_head
    department = Column(String(100), nullable=True)  # e.g., timber, peeling, prepress, hotpress
    created_at = Column(DateTime, server_default=func.now())

class TimberPurchase(Base):
    __tablename__ = "timber_purchases"
    id = Column(Integer, primary_key=True, index=True)
    sr_no = Column(Integer, nullable=True)
    master_ref = Column(Integer, nullable=True)
    bill_no = Column(String(100), nullable=True)
    bill_date = Column(Date, nullable=True)
    received_date = Column(Date, index=True, nullable=True)
    receipt_no = Column(String(100), nullable=True)
    vendor_name = Column(String(200), index=True, nullable=True)
    currency = Column(String(20), nullable=True)
    item_code = Column(String(100), nullable=True)
    item_name = Column(String(200), nullable=True)
    specification = Column(String(255), nullable=True)
    rate = Column(Float, nullable=True)
    gross_weight = Column(Float, nullable=True)
    vehicle_weight = Column(Float, nullable=True)
    return_weight = Column(Float, nullable=True)
    discount_weight = Column(Float, nullable=True)
    net_weight = Column(Float, nullable=True)
    item_bill_value = Column(Float, nullable=True)
    uploaded_by = Column(String(100), nullable=True)
    uploaded_at = Column(DateTime, server_default=func.now())

class PeelingProduction(Base):
    __tablename__ = "peeling_production"
    id = Column(Integer, primary_key=True, index=True)
    srno = Column(Integer, nullable=True)
    working_hour = Column(Float, nullable=True)
    peeling_date = Column(Date, index=True, nullable=True)
    thickness = Column(Float, nullable=True)
    size = Column(String(100), nullable=True)
    length = Column(Float, nullable=True)
    width = Column(Float, nullable=True)
    core_type = Column(String(100), nullable=True)
    peeling_machine = Column(String(100), index=True, nullable=True)
    contractor = Column(String(200), index=True, nullable=True)
    supervisor = Column(String(200), nullable=True)
    quality = Column(String(100), nullable=True)
    shift = Column(String(50), nullable=True)
    pcs = Column(Integer, nullable=True)
    sqft = Column(Float, nullable=True)
    cbm = Column(Float, nullable=True)
    sqmtr = Column(Float, nullable=True)
    uploaded_by = Column(String(100), nullable=True)
    uploaded_at = Column(DateTime, server_default=func.now())

class PrePressProduction(Base):
    __tablename__ = "prepress_production"
    id = Column(Integer, primary_key=True, index=True)
    srno = Column(Integer, nullable=True)
    lot_number = Column(String(100), index=True, nullable=True)
    prepress_date = Column(Date, index=True, nullable=True)
    process_name = Column(String(100), nullable=True)
    machine_name = Column(String(100), nullable=True)
    glue_type = Column(String(100), nullable=True)
    shift = Column(String(50), nullable=True)
    thickness = Column(Float, nullable=True)
    size_set = Column(String(100), nullable=True)
    length = Column(Float, nullable=True)
    width = Column(Float, nullable=True)
    pcs = Column(Integer, nullable=True)
    loading_time = Column(String(50), nullable=True)
    unloading_time = Column(String(50), nullable=True)
    na = Column(Float, nullable=True)
    sqmtr = Column(Float, nullable=True)
    sqft = Column(Float, nullable=True)
    cbm = Column(Float, nullable=True)
    supervisor = Column(String(200), nullable=True)
    slip_no = Column(String(100), nullable=True)
    remark = Column(String(255), nullable=True)
    entry_time = Column(String(100), nullable=True)
    entry_user = Column(String(100), nullable=True)
    uploaded_by = Column(String(100), nullable=True)
    uploaded_at = Column(DateTime, server_default=func.now())

class HotPressProduction(Base):
    __tablename__ = "hotpress_production"
    id = Column(Integer, primary_key=True, index=True)
    srno = Column(Integer, nullable=True)
    slip_no = Column(String(100), nullable=True)
    lot_group = Column(String(100), nullable=True)
    lot_number = Column(String(100), index=True, nullable=True)
    hp_date = Column(Date, index=True, nullable=True)
    process_name = Column(String(100), nullable=True)
    shift = Column(String(50), nullable=True)
    thickness = Column(Float, nullable=True)
    size_set = Column(String(100), nullable=True)
    length = Column(Float, nullable=True)
    width = Column(Float, nullable=True)
    hp_pcs = Column(Integer, nullable=True)
    hp_pcs_reject = Column(Integer, nullable=True)
    hp_na = Column(Float, nullable=True)
    hp_cbm = Column(Float, nullable=True)
    hp_sqft = Column(Float, nullable=True)
    hp_sqmtr = Column(Float, nullable=True)
    lot_type = Column(String(100), nullable=True)
    contractor = Column(String(200), index=True, nullable=True)
    uploaded_by = Column(String(100), nullable=True)
    uploaded_at = Column(DateTime, server_default=func.now())

class UploadHistory(Base):
    __tablename__ = "upload_history"
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)  # timber, peeling, prepress, hotpress
    uploaded_by = Column(String(100), nullable=False)
    uploaded_at = Column(DateTime, server_default=func.now())
    record_count = Column(Integer, nullable=False)
    status = Column(String(50), nullable=False)  # Success, Failed
    logs = Column(Text, nullable=True)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), index=True, nullable=False)
    action = Column(String(255), nullable=False)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime, server_default=func.now())

class Setting(Base):
    __tablename__ = "settings"
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, index=True, nullable=False)
    value = Column(String(255), nullable=False)
