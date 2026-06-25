import os
import datetime
import pandas as pd
import numpy as np

# Column mapping dictionaries matching Excel headers to DB columns
TIMBER_COLS = {
    'SR NO': 'sr_no',
    'MASTER REF': 'master_ref',
    'BILL NO': 'bill_no',
    'BILL DATE': 'bill_date',
    'RECEIVED DATE': 'received_date',
    'RECEIPT NO': 'receipt_no',
    'VENDOR NAME': 'vendor_name',
    'CURRENCY': 'currency',
    'ITEM CODE': 'item_code',
    'ITEM NAME': 'item_name',
    'SPECIFICATION': 'specification',
    'RATE': 'rate',
    'GROSS WEIGHT': 'gross_weight',
    'VEHICLE WEIGHT': 'vehicle_weight',
    'RETURN WEIGHT': 'return_weight',
    'DISCOUNT WEIGHT': 'discount_weight',
    'NET WEIGHT': 'net_weight',
    'ITEM BILL VALUE': 'item_bill_value'
}

PEELING_COLS = {
    'SRNO': 'srno',
    'WORKING HOUR': 'working_hour',
    'PEELING DATE': 'peeling_date',
    'THICKNESS': 'thickness',
    'SIZE': 'size',
    'LENGTH': 'length',
    'WIDTH': 'width',
    'CORE TYPE': 'core_type',
    'PEELING MACHINE': 'peeling_machine',
    'CONTRACTOR': 'contractor',
    'SUPERVISOR': 'supervisor',
    'QUALITY': 'quality',
    'SHIFT': 'shift',
    'PCS': 'pcs',
    'SQFT': 'sqft',
    'CBM': 'cbm',
    'SQMTR': 'sqmtr'
}

PREPRESS_COLS = {
    'SRNO': 'srno',
    'LOT NUMBER': 'lot_number',
    'PREPRESS DATE': 'prepress_date',
    'PROCESSNAME': 'process_name',
    'MACHINENAME': 'machine_name',
    'GLUETYPE': 'glue_type',
    'SHIFT': 'shift',
    'THICKNESS': 'thickness',
    'SIZESET': 'size_set',
    'LENGTH': 'length',
    'WIDTH': 'width',
    'PCS': 'pcs',
    'LOADINGTIME': 'loading_time',
    'UNLOADINGTIME': 'unloading_time',
    'N.A.': 'na',
    'SQMTR': 'sqmtr',
    'SQFT': 'sqft',
    'CBM': 'cbm',
    'SUPERVISOR': 'supervisor',
    'SLIP NO': 'slip_no',
    'REMARK': 'remark',
    'ENTRY_TIME': 'entry_time',
    'ENTRY_USER': 'entry_user'
}

HOTPRESS_COLS = {
    'SRNO': 'srno',
    'SLIP NO': 'slip_no',
    'LOT GROUP': 'lot_group',
    'LOT NUMBER': 'lot_number',
    'HP_DATE': 'hp_date',
    'PROCESSNAME': 'process_name',
    'SHIFT': 'shift',
    'THICKNESS': 'thickness',
    'SIZESET': 'size_set',
    'LENGTH': 'length',
    'WIDTH': 'width',
    'HP PCS': 'hp_pcs',
    'HP_PCS_REJECT': 'hp_pcs_reject',
    'HP N.A.': 'hp_na',
    'HP CBM': 'hp_cbm',
    'HP SQFT': 'hp_sqft',
    'HP SQMTR': 'hp_sqmtr',
    'LOT TYPE': 'lot_type',
    'CONTRACTOR': 'contractor'
}

def clean_value(val):
    """Convert pandas/numpy nulls to python None, otherwise clean string or numeric type."""
    if pd.isna(val):
        return None
    if isinstance(val, (int, float, np.integer, np.floating)):
        # Convert numpy types to python native types
        return int(val) if isinstance(val, (int, np.integer)) else float(val)
    val_str = str(val).strip()
    if val_str in ("NaN", "nan", "NAT", "nat", "NULL", "null", "None", ""):
        return None
    return val_str

def parse_date(val):
    """Convert spreadsheet cell to standard date object."""
    if pd.isna(val):
        return None
    val_str = str(val).strip()
    if val_str in ("", "nan", "None", "NULL"):
        return None
    # Support multiple common formats
    for fmt in ("%d-%b-%Y", "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%b-%Y %H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M:%S.%f"):
        try:
            return datetime.datetime.strptime(val_str, fmt).date()
        except ValueError:
            pass
    try:
        return pd.to_datetime(val_str).date()
    except Exception:
        return None

def parse_excel_html(file_path_or_bytes):
    """Helper to parse the single HTML grid table from spreadsheet exports."""
    try:
        dfs = pd.read_html(file_path_or_bytes)
        if not dfs:
            raise ValueError("No table found in Excel file.")
        return dfs[0]
    except Exception as e:
        raise ValueError(f"Failed to read spreadsheet as HTML table: {str(e)}")

def parse_timber_purchase(file_path_or_bytes) -> list:
    """Parse TIMBERpurchasereport.xls table."""
    df = parse_excel_html(file_path_or_bytes)
    # Check if necessary columns exist
    for col in ['SR NO', 'VENDOR NAME']:
        if col not in df.columns:
            raise ValueError(f"Missing required column '{col}' for Timber Purchase Report.")
            
    records = []
    for _, row in df.iterrows():
        # Skip summary or fully empty rows
        if pd.isna(row.get('SR NO')) or pd.isna(row.get('VENDOR NAME')):
            continue
            
        data = {}
        for xls_header, db_col in TIMBER_COLS.items():
            val = row.get(xls_header)
            if db_col in ('bill_date', 'received_date'):
                data[db_col] = parse_date(val)
            else:
                data[db_col] = clean_value(val)
        records.append(data)
    return records

def parse_peeling_report(file_path_or_bytes) -> list:
    """Parse PeelingReport.xls table."""
    df = parse_excel_html(file_path_or_bytes)
    
    # Check if columns exist
    if 'PEELING DATE' not in df.columns and 'PEELING_DATE' not in df.columns:
        # Check if column names are slightly off
        df.columns = [str(c).strip().upper() for c in df.columns]
        
    records = []
    for _, row in df.iterrows():
        # Skip totals rows
        supervisor = str(row.get('SUPERVISOR', '')).strip().upper()
        if 'TOTAL :' in supervisor or 'GRAND TOTAL' in supervisor:
            continue
        # Skip empty lines
        if pd.isna(row.get('SRNO')) and pd.isna(row.get('PEELING DATE')):
            continue
            
        data = {}
        for xls_header, db_col in PEELING_COLS.items():
            val = row.get(xls_header)
            if db_col == 'peeling_date':
                data[db_col] = parse_date(val)
            else:
                data[db_col] = clean_value(val)
        records.append(data)
    return records

def parse_prepress_report(file_path_or_bytes) -> list:
    """Parse PREPRESSDatewise (1).xls table."""
    df = parse_excel_html(file_path_or_bytes)
    
    records = []
    for _, row in df.iterrows():
        supervisor = str(row.get('SUPERVISOR', '')).strip().upper()
        if 'TOTAL' in supervisor or 'GRAND' in supervisor:
            continue
        if pd.isna(row.get('SRNO')) and pd.isna(row.get('LOT NUMBER')):
            continue
            
        data = {}
        for xls_header, db_col in PREPRESS_COLS.items():
            val = row.get(xls_header)
            if db_col == 'prepress_date':
                data[db_col] = parse_date(val)
            else:
                data[db_col] = clean_value(val)
        records.append(data)
    return records

def parse_hotpress_report(file_path_or_bytes) -> list:
    """Parse HotPressMatStockReportDatewise.xls table."""
    df = parse_excel_html(file_path_or_bytes)
    
    records = []
    for _, row in df.iterrows():
        # Clean totals row if present
        contractor = str(row.get('CONTRACTOR', '')).strip().upper()
        if 'TOTAL' in contractor or 'GRAND' in contractor:
            continue
        if pd.isna(row.get('SRNO')) and pd.isna(row.get('LOT NUMBER')):
            continue
            
        data = {}
        for xls_header, db_col in HOTPRESS_COLS.items():
            val = row.get(xls_header)
            if db_col == 'hp_date':
                data[db_col] = parse_date(val)
            else:
                data[db_col] = clean_value(val)
        records.append(data)
    return records
