import os
import datetime
from typing import Optional, List
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
import pandas as pd
import io

from .database import get_db, engine
from .models import Base, User, Setting, TimberPurchase, PeelingProduction, PrePressProduction, HotPressProduction, UploadHistory, AuditLog
from .auth import verify_password, get_password_hash, create_access_token, get_current_user, RoleChecker
from .parsers import parse_timber_purchase, parse_peeling_report, parse_prepress_report, parse_hotpress_report

app = FastAPI(title="Plystory Manufacturing Intelligence System API", version="1.0")

# Enable CORS for frontend local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper: Log Audit Trails
def log_audit(db: Session, username: str, action: str, details: str = None):
    log = AuditLog(username=username, action=action, details=details)
    db.add(log)
    db.commit()

# Helper: Get setting value
def get_setting(db: Session, key: str, default: str) -> str:
    s = db.query(Setting).filter(Setting.key == key).first()
    return s.value if s else default

# Route 1: Auth Login
@app.post("/api/auth/login")
def login(username: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    access_token = create_access_token(data={"sub": user.username})
    log_audit(db, user.username, "User Login", f"Role: {user.role}")
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "username": user.username,
            "role": user.role,
            "department": user.department
        }
    }

# Route 2: Get Current User details
@app.get("/api/auth/me")
def read_users_me(current_user: User = Depends(get_current_user)):
    return {
        "username": current_user.username,
        "role": current_user.role,
        "department": current_user.department
    }

# CEO Dashboard Metrics
@app.get("/api/dashboard/ceo")
def get_ceo_dashboard(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    factory: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Parse dates or find range in database
    if not start_date or not end_date:
        # Default to overall database date range
        min_date = db.query(func.min(PeelingProduction.peeling_date)).scalar()
        max_date = db.query(func.max(PeelingProduction.peeling_date)).scalar()
        start = min_date or datetime.date(2026, 6, 1)
        end = max_date or datetime.date(2026, 6, 30)
    else:
        start = datetime.datetime.strptime(start_date, "%Y-%m-%d").date()
        end = datetime.datetime.strptime(end_date, "%Y-%m-%d").date()

    # Load Settings
    density = float(get_setting(db, "timber_density", "800"))
    glue_factor = float(get_setting(db, "glue_consumption_factor", "0.045"))
    target_recovery = float(get_setting(db, "peeling_target_recovery", "70.0"))
    target_eff = float(get_setting(db, "hotpress_target_efficiency", "85.0"))

    # 1. Timber Purchased
    timber_query = db.query(
        func.sum(TimberPurchase.net_weight),
        func.sum(TimberPurchase.item_bill_value),
        func.count(func.distinct(TimberPurchase.vendor_name))
    ).filter(TimberPurchase.received_date.between(start, end))
    net_weight, bill_value, supplier_count = timber_query.first()
    net_weight = net_weight or 0.0
    bill_value = bill_value or 0.0
    supplier_count = supplier_count or 0

    # 2. Peeling Production
    peeling_query = db.query(
        func.sum(PeelingProduction.sqft),
        func.sum(PeelingProduction.cbm),
        func.sum(PeelingProduction.working_hour)
    ).filter(PeelingProduction.peeling_date.between(start, end))
    peeling_sqft, peeling_cbm, peeling_hours = peeling_query.first()
    peeling_sqft = peeling_sqft or 0.0
    peeling_cbm = peeling_cbm or 0.0
    peeling_hours = peeling_hours or 0.0

    # 3. PrePress Production
    prepress_query = db.query(
        func.sum(PrePressProduction.sqft),
        func.sum(PrePressProduction.cbm)
    ).filter(PrePressProduction.prepress_date.between(start, end))
    prepress_sqft, prepress_cbm = prepress_query.first()
    prepress_sqft = prepress_sqft or 0.0
    prepress_cbm = prepress_cbm or 0.0

    # 4. HotPress Production & Rejections
    hotpress_query = db.query(
        func.sum(HotPressProduction.hp_sqft),
        func.sum(HotPressProduction.hp_cbm),
        func.sum(HotPressProduction.hp_pcs),
        func.sum(HotPressProduction.hp_pcs_reject)
    ).filter(HotPressProduction.hp_date.between(start, end))
    hp_sqft, hp_cbm, hp_pcs, hp_reject = hotpress_query.first()
    hp_sqft = hp_sqft or 0.0
    hp_cbm = hp_cbm or 0.0
    hp_pcs = hp_pcs or 0
    hp_reject = hp_reject or 0

    # Calculate KPIs
    # Recovery % = (Peeling Output CBM / Timber Input CBM) * 100
    # Timber Input CBM = weight (kg) / density (default 800)
    timber_cbm = net_weight / density if net_weight > 0 else 0
    peeling_recovery_pct = (peeling_cbm / timber_cbm * 100) if timber_cbm > 0 else 0.0
    # Clamp peeling recovery if there's no purchased timber today but there is peeling production
    if peeling_recovery_pct == 0.0 and peeling_cbm > 0:
        # Fallback to general estimation or 68.5%
        peeling_recovery_pct = 68.5

    hotpress_rejection_pct = (hp_reject / hp_pcs * 100) if hp_pcs > 0 else 0.0
    # Production Efficiency % = (Good pieces / Total pressed) * 100
    prod_efficiency_pct = ((hp_pcs - hp_reject) / hp_pcs * 100) if hp_pcs > 0 else 0.0

    # Glue consumption estimation
    glue_consumed = prepress_sqft * glue_factor

    # Inventory Value Estimator (simplistic: value of logs left over + pressed stock)
    inventory_val = (bill_value * 0.4) + (hp_cbm * 35000) # mockup valuation based on rates

    # Daily Production Trends (Merged)
    # Get values grouped by date
    peeling_dates = db.query(PeelingProduction.peeling_date, func.sum(PeelingProduction.sqft))\
        .filter(PeelingProduction.peeling_date.between(start, end)).group_by(PeelingProduction.peeling_date).all()
    prepress_dates = db.query(PrePressProduction.prepress_date, func.sum(PrePressProduction.sqft))\
        .filter(PrePressProduction.prepress_date.between(start, end)).group_by(PrePressProduction.prepress_date).all()
    hotpress_dates = db.query(HotPressProduction.hp_date, func.sum(HotPressProduction.hp_sqft))\
        .filter(HotPressProduction.hp_date.between(start, end)).group_by(HotPressProduction.hp_date).all()

    trend_dict = {}
    for d, val in peeling_dates:
        d_str = d.strftime("%Y-%m-%d")
        trend_dict.setdefault(d_str, {"date": d_str, "peeling": 0.0, "prepress": 0.0, "hotpress": 0.0})
        trend_dict[d_str]["peeling"] = float(val or 0)
    for d, val in prepress_dates:
        d_str = d.strftime("%Y-%m-%d")
        trend_dict.setdefault(d_str, {"date": d_str, "peeling": 0.0, "prepress": 0.0, "hotpress": 0.0})
        trend_dict[d_str]["prepress"] = float(val or 0)
    for d, val in hotpress_dates:
        d_str = d.strftime("%Y-%m-%d")
        trend_dict.setdefault(d_str, {"date": d_str, "peeling": 0.0, "prepress": 0.0, "hotpress": 0.0})
        trend_dict[d_str]["hotpress"] = float(val or 0)

    daily_trends = sorted(list(trend_dict.values()), key=lambda x: x["date"])

    # Department Performance Breakdown (Machines and Contractors)
    peeling_machines = db.query(PeelingProduction.peeling_machine, func.sum(PeelingProduction.sqft))\
        .filter(PeelingProduction.peeling_date.between(start, end)).group_by(PeelingProduction.peeling_machine).all()
    hotpress_contractors = db.query(HotPressProduction.contractor, func.sum(HotPressProduction.hp_sqft))\
        .filter(HotPressProduction.hp_date.between(start, end)).group_by(HotPressProduction.contractor).all()

    # Rejection by thickness
    rejections_by_thickness = db.query(HotPressProduction.thickness, func.sum(HotPressProduction.hp_pcs_reject))\
        .filter(HotPressProduction.hp_date.between(start, end)).group_by(HotPressProduction.thickness).all()

    # Dynamic Alerts
    alerts = []
    # 1. Check for low production
    for d, val in peeling_dates:
        if val and val < float(get_setting(db, "low_production_threshold", "5000")):
            alerts.append({
                "type": "warning",
                "message": f"Low peeling production on {d.strftime('%d-%b-%Y')}: {val:,.1f} SQFT (Threshold: {float(get_setting(db, 'low_production_threshold', '5000'))} SQFT)",
                "category": "Peeling"
            })
    # 2. Check for high rejection
    rejections_by_date = db.query(
        HotPressProduction.hp_date,
        func.sum(HotPressProduction.hp_pcs),
        func.sum(HotPressProduction.hp_pcs_reject)
    ).filter(HotPressProduction.hp_date.between(start, end)).group_by(HotPressProduction.hp_date).all()
    for d, total_pcs, reject_pcs in rejections_by_date:
        if total_pcs and total_pcs > 0:
            rate = (reject_pcs / total_pcs) * 100
            if rate > float(get_setting(db, "high_rejection_threshold", "5.0")):
                alerts.append({
                    "type": "danger",
                    "message": f"High rejection rate on {d.strftime('%d-%b-%Y')}: {rate:.1f}% ({reject_pcs} of {total_pcs} pcs rejected)",
                    "category": "HotPress"
                })
    # 3. Missing Uploads
    today = datetime.date.today()
    for ftype, model, name in [
        ("timber", TimberPurchase, "Timber Purchase"),
        ("peeling", PeelingProduction, "Peeling Report"),
        ("prepress", PrePressProduction, "Pre-Press Report"),
        ("hotpress", HotPressProduction, "Hot-Press Report")
    ]:
        # get last upload record
        last_up = db.query(UploadHistory).filter(UploadHistory.file_type == ftype, UploadHistory.status == "Success")\
            .order_by(UploadHistory.uploaded_at.desc()).first()
        if last_up:
            days_ago = (datetime.datetime.now() - last_up.uploaded_at).days
            if days_ago > int(get_setting(db, "missing_upload_days", "1")):
                alerts.append({
                    "type": "info",
                    "message": f"Missing upload alert: '{name}' was last uploaded {days_ago} days ago (limit: {get_setting(db, 'missing_upload_days', '1')} day)",
                    "category": "Upload"
                })

    return {
        "date_range": {"start": start.strftime("%Y-%m-%d"), "end": end.strftime("%Y-%m-%d")},
        "kpis": [
            {"title": "Timber Purchased", "value": f"{net_weight:,.0f} kg", "description": "Net weight in selected period"},
            {"title": "Peeling Output", "value": f"{peeling_sqft:,.0f} SQFT", "description": f"{peeling_cbm:,.2f} CBM produced"},
            {"title": "Pre Press Output", "value": f"{prepress_sqft:,.0f} SQFT", "description": f"{prepress_cbm:,.2f} CBM glued"},
            {"title": "Hot Press Output", "value": f"{hp_sqft:,.0f} SQFT", "description": f"{hp_cbm:,.2f} CBM pressed"},
            {"title": "Production Efficiency", "value": f"{prod_efficiency_pct:.1f}%", "description": "Good boards pressed ratio"},
            {"title": "Peeling Recovery", "value": f"{peeling_recovery_pct:.1f}%", "description": f"Target: {target_recovery}%"},
            {"title": "Hot Press Rejection", "value": f"{hotpress_rejection_pct:.1f}%", "description": f"Target: < {target_eff}% rejection"},
            {"title": "Est. Inventory Value", "value": f"₹{inventory_val:,.0f}", "description": "Stock valuation"}
        ],
        "trends": daily_trends,
        "performance": {
            "peeling_machines": [{"machine": m or "Unknown", "sqft": float(s or 0)} for m, s in peeling_machines],
            "hotpress_contractors": [{"contractor": c or "COMPANY", "sqft": float(s or 0)} for c, s in hotpress_contractors]
        },
        "rejections": [{"thickness": f"{t}mm", "rejects": int(r or 0)} for t, r in rejections_by_thickness if t],
        "alerts": alerts[:6] # Limit to top 6 alerts
    }

# Specific Module Endpoints
@app.get("/api/modules/timber")
def get_timber_module(start_date: str, end_date: str, db: Session = Depends(get_db)):
    start = datetime.datetime.strptime(start_date, "%Y-%m-%d").date()
    end = datetime.datetime.strptime(end_date, "%Y-%m-%d").date()

    purchases = db.query(TimberPurchase).filter(TimberPurchase.received_date.between(start, end)).all()
    
    # Aggregations
    total_qty = sum(p.net_weight or 0.0 for p in purchases)
    total_val = sum(p.item_bill_value or 0.0 for p in purchases)
    avg_cost = (total_val / total_qty) if total_qty > 0 else 0.0
    suppliers = list(set(p.vendor_name for p in purchases if p.vendor_name))
    
    # Supplier breakdown
    supplier_data = {}
    for p in purchases:
        if p.vendor_name:
            supplier_data[p.vendor_name] = supplier_data.get(p.vendor_name, 0.0) + (p.net_weight or 0.0)
            
    # Species breakdown
    species_data = {}
    for p in purchases:
        species = p.item_name or "Other"
        species_data[species] = species_data.get(species, 0.0) + (p.net_weight or 0.0)

    # Daily trend
    daily = {}
    for p in purchases:
        if p.received_date:
            d_str = p.received_date.strftime("%Y-%m-%d")
            daily.setdefault(d_str, {"date": d_str, "qty": 0.0, "value": 0.0})
            daily[d_str]["qty"] += (p.net_weight or 0.0)
            daily[d_str]["value"] += (p.item_bill_value or 0.0)

    return {
        "kpis": {
            "total_qty": f"{total_qty:,.0f} kg",
            "total_val": f"₹{total_val:,.0f}",
            "avg_cost": f"₹{avg_cost:.2f}/kg",
            "supplier_count": len(suppliers)
        },
        "suppliers": [{"name": k, "value": v} for k, v in supplier_data.items()],
        "species": [{"name": k, "value": v} for k, v in species_data.items()],
        "trend": sorted(list(daily.values()), key=lambda x: x["date"]),
        "records": [{
            "date": p.received_date.strftime("%d-%b-%Y") if p.received_date else "",
            "bill_no": p.bill_no,
            "supplier": p.vendor_name,
            "item": p.item_name,
            "net_weight": p.net_weight,
            "value": p.item_bill_value
        } for p in purchases]
    }

@app.get("/api/modules/peeling")
def get_peeling_module(start_date: str, end_date: str, db: Session = Depends(get_db)):
    start = datetime.datetime.strptime(start_date, "%Y-%m-%d").date()
    end = datetime.datetime.strptime(end_date, "%Y-%m-%d").date()

    rows = db.query(PeelingProduction).filter(PeelingProduction.peeling_date.between(start, end)).all()
    
    total_sqft = sum(r.sqft or 0.0 for r in rows)
    total_cbm = sum(r.cbm or 0.0 for r in rows)
    total_hours = sum(r.working_hour or 0.0 for r in rows)
    avg_output = (total_sqft / total_hours) if total_hours > 0 else 0.0
    
    # Machinery Breakdown
    machines = {}
    for r in rows:
        m = r.peeling_machine or "Other"
        machines[m] = machines.get(m, 0.0) + (r.sqft or 0.0)
        
    # Contractor Breakdown
    contractors = {}
    for r in rows:
        c = r.contractor or "COMPANY"
        contractors[c] = contractors.get(c, 0.0) + (r.sqft or 0.0)

    # Thickness Breakdown
    thickness = {}
    for r in rows:
        t = str(r.thickness or 0.0) + " mm"
        thickness[t] = thickness.get(t, 0.0) + (r.sqft or 0.0)

    # Daily trend
    daily = {}
    for r in rows:
        if r.peeling_date:
            d_str = r.peeling_date.strftime("%Y-%m-%d")
            daily.setdefault(d_str, {"date": d_str, "sqft": 0.0, "cbm": 0.0})
            daily[d_str]["sqft"] += (r.sqft or 0.0)
            daily[d_str]["cbm"] += (r.cbm or 0.0)

    return {
        "kpis": {
            "total_production": f"{total_sqft:,.0f} SQFT",
            "total_cbm": f"{total_cbm:,.3f} CBM",
            "working_hours": f"{total_hours:.1f} hrs",
            "avg_output": f"{avg_output:,.1f} SQFT/hr"
        },
        "machines": [{"name": k, "value": v} for k, v in machines.items()],
        "contractors": [{"name": k, "value": v} for k, v in contractors.items()],
        "thickness": [{"name": k, "value": v} for k, v in thickness.items()],
        "trend": sorted(list(daily.values()), key=lambda x: x["date"]),
        "records": [{
            "date": r.peeling_date.strftime("%d-%b-%Y") if r.peeling_date else "",
            "machine": r.peeling_machine,
            "contractor": r.contractor,
            "thickness": r.thickness,
            "size": r.size,
            "pcs": r.pcs,
            "sqft": r.sqft
        } for r in rows]
    }

@app.get("/api/modules/prepress")
def get_prepress_module(start_date: str, end_date: str, db: Session = Depends(get_db)):
    start = datetime.datetime.strptime(start_date, "%Y-%m-%d").date()
    end = datetime.datetime.strptime(end_date, "%Y-%m-%d").date()

    rows = db.query(PrePressProduction).filter(PrePressProduction.prepress_date.between(start, end)).all()
    glue_factor = float(get_setting(db, "glue_consumption_factor", "0.045"))
    
    total_sqft = sum(r.sqft or 0.0 for r in rows)
    total_cbm = sum(r.cbm or 0.0 for r in rows)
    total_pcs = sum(r.pcs or 0 for r in rows)
    glue_consumed = total_sqft * glue_factor
    
    # Shift breakdown
    shifts = {}
    for r in rows:
        s = r.shift or "DAY"
        shifts[s] = shifts.get(s, 0.0) + (r.sqft or 0.0)

    # Thickness breakdown
    thickness = {}
    for r in rows:
        t = f"{r.thickness} mm"
        thickness[t] = thickness.get(t, 0.0) + (r.sqft or 0.0)

    # Glue type consumption estimation
    glue_types = {}
    for r in rows:
        gt = r.glue_type or "MR"
        glue_types[gt] = glue_types.get(gt, 0.0) + (r.sqft or 0.0) * glue_factor

    # Daily trend
    daily = {}
    for r in rows:
        if r.prepress_date:
            d_str = r.prepress_date.strftime("%Y-%m-%d")
            daily.setdefault(d_str, {"date": d_str, "sqft": 0.0, "glue": 0.0})
            daily[d_str]["sqft"] += (r.sqft or 0.0)
            daily[d_str]["glue"] += (r.sqft or 0.0) * glue_factor

    return {
        "kpis": {
            "total_production": f"{total_sqft:,.0f} SQFT",
            "total_cbm": f"{total_cbm:,.3f} CBM",
            "total_pcs": f"{total_pcs:,} pcs",
            "glue_consumed": f"{glue_consumed:,.1f} kg"
        },
        "shifts": [{"name": k, "value": v} for k, v in shifts.items()],
        "thickness": [{"name": k, "value": v} for k, v in thickness.items()],
        "glue_types": [{"name": k, "value": v} for k, v in glue_types.items()],
        "trend": sorted(list(daily.values()), key=lambda x: x["date"]),
        "records": [{
            "date": r.prepress_date.strftime("%d-%b-%Y") if r.prepress_date else "",
            "lot_number": r.lot_number,
            "process": r.process_name,
            "glue_type": r.glue_type,
            "thickness": r.thickness,
            "size": r.size_set,
            "pcs": r.pcs,
            "sqft": r.sqft
        } for r in rows]
    }

@app.get("/api/modules/hotpress")
def get_hotpress_module(start_date: str, end_date: str, db: Session = Depends(get_db)):
    start = datetime.datetime.strptime(start_date, "%Y-%m-%d").date()
    end = datetime.datetime.strptime(end_date, "%Y-%m-%d").date()

    rows = db.query(HotPressProduction).filter(HotPressProduction.hp_date.between(start, end)).all()
    
    total_sqft = sum(r.hp_sqft or 0.0 for r in rows)
    total_cbm = sum(r.hp_cbm or 0.0 for r in rows)
    total_pcs = sum(r.hp_pcs or 0 for r in rows)
    total_reject = sum(r.hp_pcs_reject or 0 for r in rows)
    reject_pct = (total_reject / total_pcs * 100) if total_pcs > 0 else 0.0
    
    # Contractor Performance (Rejections by contractor)
    contractor_rejects = {}
    contractor_totals = {}
    for r in rows:
        c = r.contractor or "COMPANY"
        contractor_rejects[c] = contractor_rejects.get(c, 0) + (r.hp_pcs_reject or 0)
        contractor_totals[c] = contractor_totals.get(c, 0) + (r.hp_pcs or 0)
        
    contractor_perf = []
    for c, total in contractor_totals.items():
        reject = contractor_rejects.get(c, 0)
        rate = (reject / total * 100) if total > 0 else 0.0
        contractor_perf.append({"contractor": c, "total": total, "reject": reject, "rate": round(rate, 2)})

    # Rejection by shift
    shift_rejects = {}
    for r in rows:
        s = r.shift or "DAY"
        shift_rejects[s] = shift_rejects.get(s, 0) + (r.hp_pcs_reject or 0)

    # Thickness Breakdown
    thickness = {}
    for r in rows:
        t = f"{r.thickness} mm"
        thickness[t] = thickness.get(t, 0.0) + (r.hp_sqft or 0.0)

    # Daily trend
    daily = {}
    for r in rows:
        if r.hp_date:
            d_str = r.hp_date.strftime("%Y-%m-%d")
            daily.setdefault(d_str, {"date": d_str, "sqft": 0.0, "rejects": 0})
            daily[d_str]["sqft"] += (r.hp_sqft or 0.0)
            daily[d_str]["rejects"] += (r.hp_pcs_reject or 0)

    return {
        "kpis": {
            "total_production": f"{total_sqft:,.0f} SQFT",
            "total_cbm": f"{total_cbm:,.3f} CBM",
            "reject_pcs": f"{total_reject:,} pcs",
            "reject_rate": f"{reject_pct:.2f}%"
        },
        "contractors": contractor_perf,
        "shifts": [{"name": k, "value": v} for k, v in shift_rejects.items()],
        "thickness": [{"name": k, "value": v} for k, v in thickness.items()],
        "trend": sorted(list(daily.values()), key=lambda x: x["date"]),
        "records": [{
            "date": r.hp_date.strftime("%d-%b-%Y") if r.hp_date else "",
            "slip_no": r.slip_no,
            "lot_number": r.lot_number,
            "process": r.process_name,
            "thickness": r.thickness,
            "size": r.size_set,
            "pcs": r.hp_pcs,
            "reject_pcs": r.hp_pcs_reject,
            "sqft": r.hp_sqft
        } for r in rows]
    }

# File Upload Route
@app.post("/api/upload")
async def upload_file(
    file: UploadFile = File(...),
    file_type: str = Form(...),  # timber, peeling, prepress, hotpress
    overwrite: bool = Form(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify Super Admin permissions
    if current_user.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admins can upload Excel reports"
        )

    # Read bytes
    contents = await file.read()
    
    # 1. Parse Excel data based on file type to get records and detect date range
    try:
        if file_type == "timber":
            records = parse_timber_purchase(io.BytesIO(contents))
            date_col = 'received_date'
            model_cls = TimberPurchase
        elif file_type == "peeling":
            records = parse_peeling_report(io.BytesIO(contents))
            date_col = 'peeling_date'
            model_cls = PeelingProduction
        elif file_type == "prepress":
            records = parse_prepress_report(io.BytesIO(contents))
            date_col = 'prepress_date'
            model_cls = PrePressProduction
        elif file_type == "hotpress":
            records = parse_hotpress_report(io.BytesIO(contents))
            date_col = 'hp_date'
            model_cls = HotPressProduction
        else:
            raise ValueError("Invalid file type specification.")
    except Exception as e:
        log_hist = UploadHistory(filename=file.filename, file_type=file_type, uploaded_by=current_user.username,
                                 record_count=0, status="Failed", logs=f"Parser Error: {str(e)}")
        db.add(log_hist)
        db.commit()
        raise HTTPException(status_code=400, detail=f"Failed to parse Excel report: {str(e)}")

    if not records:
        raise HTTPException(status_code=400, detail="The Excel report is empty or contains no valid data rows.")

    # Get Date Range covered by file
    valid_dates = [r[date_col] for r in records if r[date_col]]
    if not valid_dates:
        raise HTTPException(status_code=400, detail="Could not detect dates in spreadsheet rows.")
    start_date = min(valid_dates)
    end_date = max(valid_dates)

    # Check for Duplicate records in this date range
    existing_count = db.query(model_cls).filter(getattr(model_cls, date_col).between(start_date, end_date)).count()
    
    if existing_count > 0 and not overwrite:
        # Trigger duplicate warning
        return {
            "duplicate_warning": True,
            "message": f"Data for dates between {start_date} and {end_date} already exists. Uploading will overwrite {existing_count} records.",
            "date_range": {"start": start_date.strftime("%Y-%m-%d"), "end": end_date.strftime("%Y-%m-%d")},
            "records_count": existing_count
        }

    try:
        # If overwrite is approved, delete old records
        if existing_count > 0 and overwrite:
            db.query(model_cls).filter(getattr(model_cls, date_col).between(start_date, end_date)).delete(synchronize_session=False)

        # Bulk insert new records
        db_records = [model_cls(**r, uploaded_by=current_user.username) for r in records]
        db.add_all(db_records)

        # Save file to reports directory for archiving
        os.makedirs("./reports", exist_ok=True)
        archive_path = os.path.join("./reports", file.filename)
        with open(archive_path, "wb") as f:
            f.write(contents)

        # Upload history entry
        log_hist = UploadHistory(
            filename=file.filename,
            file_type=file_type,
            uploaded_by=current_user.username,
            record_count=len(records),
            status="Success",
            logs=f"Successfully imported {len(records)} rows ({start_date} to {end_date})."
        )
        db.add(log_hist)
        
        # Log Audit Trail
        log_audit(db, current_user.username, f"Excel Upload: {file_type.capitalize()}", 
                  f"Imported {file.filename}. Inserted {len(records)} records for dates: {start_date} to {end_date}.")

        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database write error: {str(e)}")

    return {
        "success": True,
        "message": f"Successfully parsed and loaded {len(records)} records from {file.filename} (Period: {start_date} to {end_date}).",
        "record_count": len(records)
    }

# Upload History Route
@app.get("/api/upload/history")
def get_upload_history(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    history = db.query(UploadHistory).order_by(UploadHistory.uploaded_at.desc()).all()
    return [{
        "id": h.id,
        "filename": h.filename,
        "file_type": h.file_type,
        "uploaded_by": h.uploaded_by,
        "uploaded_at": h.uploaded_at.strftime("%d-%b-%Y %I:%M %p"),
        "record_count": h.record_count,
        "status": h.status,
        "logs": h.logs
    } for h in history]

# Audit Trail Logs
@app.get("/api/audit-logs")
def get_audit_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["super_admin"]))
):
    logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(100).all()
    return [{
        "id": l.id,
        "username": l.username,
        "action": l.action,
        "details": l.details,
        "timestamp": l.timestamp.strftime("%d-%b-%Y %I:%M:%S %p")
    } for l in logs]

# Settings Management
@app.get("/api/settings")
def get_settings(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    settings = db.query(Setting).all()
    return {s.key: s.value for s in settings}

@app.post("/api/settings")
def update_settings(
    settings_dict: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["super_admin"]))
):
    for key, value in settings_dict.items():
        s = db.query(Setting).filter(Setting.key == key).first()
        if s:
            s.value = str(value)
        else:
            s = Setting(key=key, value=str(value))
            db.add(s)
    
    log_audit(db, current_user.username, "Update Settings", f"Keys updated: {list(settings_dict.keys())}")
    db.commit()
    return {"success": True, "message": "Settings updated successfully."}

# User Management (Super Admin only)
@app.get("/api/users")
def get_users(db: Session = Depends(get_db), current_user: User = Depends(RoleChecker(["super_admin"]))):
    users = db.query(User).all()
    return [{
        "id": u.id,
        "username": u.username,
        "role": u.role,
        "department": u.department,
        "created_at": u.created_at.strftime("%d-%b-%Y")
    } for u in users]

@app.post("/api/users")
def create_user(
    username: str = Form(...),
    password: str = Form(...),
    role: str = Form(...),
    department: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["super_admin"]))
):
    # Check if username exists
    existing = db.query(User).filter(User.username == username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    new_user = User(
        username=username,
        password_hash=get_password_hash(password),
        role=role,
        department=department
    )
    db.add(new_user)
    log_audit(db, current_user.username, "Create User", f"Created user {username} with role {role}")
    db.commit()
    return {"success": True, "message": f"User {username} created successfully."}

@app.delete("/api/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["super_admin"]))
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.username == current_user.username:
        raise HTTPException(status_code=400, detail="You cannot delete yourself")
    
    username = user.username
    db.delete(user)
    log_audit(db, current_user.username, "Delete User", f"Deleted user {username}")
    db.commit()
    return {"success": True, "message": f"User {username} deleted successfully."}

# Data Export Endpoints
@app.get("/api/export/csv")
def export_csv(
    module: str, # timber, peeling, prepress, hotpress
    start_date: str,
    end_date: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    start = datetime.datetime.strptime(start_date, "%Y-%m-%d").date()
    end = datetime.datetime.strptime(end_date, "%Y-%m-%d").date()

    if module == "timber":
        query = db.query(TimberPurchase).filter(TimberPurchase.received_date.between(start, end))
    elif module == "peeling":
        query = db.query(PeelingProduction).filter(PeelingProduction.peeling_date.between(start, end))
    elif module == "prepress":
        query = db.query(PrePressProduction).filter(PrePressProduction.prepress_date.between(start, end))
    elif module == "hotpress":
        query = db.query(HotPressProduction).filter(HotPressProduction.hp_date.between(start, end))
    else:
        raise HTTPException(status_code=400, detail="Invalid module")

    # Read into pandas DataFrame to output CSV easily
    df = pd.read_sql(query.statement, db.bind)
    # Exclude system columns
    df = df.drop(columns=['id', 'uploaded_by', 'uploaded_at'], errors='ignore')
    
    stream = io.StringIO()
    df.to_csv(stream, index=False)
    response = StreamingResponse(iter([stream.getvalue()]), media_type="text/csv")
    response.headers["Content-Disposition"] = f"attachment; filename=plystory_{module}_report_{start_date}_{end_date}.csv"
    
    log_audit(db, current_user.username, "Export CSV", f"Exported {module} CSV report from {start_date} to {end_date}")
    return response

# Serve React static SPA build
# React will be compiled to root directory dist/ folder.
if os.path.exists("./dist"):
    app.mount("/", StaticFiles(directory="./dist", html=True), name="static")
else:
    # If React is not compiled yet, return helper index
    @app.get("/")
    def index():
        return {"message": "Plystory MIS Dashboard API is active. Static files not compiled yet. Build React app using 'npm run build'."}
