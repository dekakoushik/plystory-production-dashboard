import os
from backend.parsers import (
    parse_timber_purchase,
    parse_peeling_report,
    parse_prepress_report,
    parse_hotpress_report
)

reports_dir = r"c:\Users\HP\Downloads\ERP Report\reports"

test_cases = [
    {
        "filename": "TIMBERpurchasereport.xls",
        "parser": parse_timber_purchase,
        "type": "Timber Purchase"
    },
    {
        "filename": "PeelingReport.xls",
        "parser": parse_peeling_report,
        "type": "Peeling Production"
    },
    {
        "filename": "PREPRESSDatewise (1).xls",
        "parser": parse_prepress_report,
        "type": "Pre-Press Production"
    },
    {
        "filename": "HotPressMatStockReportDatewise.xls",
        "parser": parse_hotpress_report,
        "type": "Hot-Press Production"
    }
]

print("=== Running Parser Verification Tests ===")

all_ok = True
for tc in test_cases:
    path = os.path.join(reports_dir, tc["filename"])
    print(f"\nTesting {tc['type']} parser on file: {tc['filename']}...")
    if not os.path.exists(path):
        print(f"ERROR: File not found at {path}")
        all_ok = False
        continue
    
    try:
        records = tc["parser"](path)
        print(f"SUCCESS! Extracted {len(records)} records.")
        if records:
            print("First record preview:")
            for k, v in records[0].items():
                print(f"  {k}: {v} ({type(v).__name__})")
        else:
            print("WARNING: Extracted 0 records!")
            all_ok = False
    except Exception as e:
        print(f"ERROR during parsing: {e}")
        import traceback
        traceback.print_exc()
        all_ok = False

print("\n" + "="*40)
if all_ok:
    print("ALL PARSERS VERIFIED SUCCESSFULLY!")
else:
    print("SOME PARSERS ENCOUNTERED ERRORS.")
