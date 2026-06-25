import os
import sys
import subprocess

def main():
    print("=== Plystory Manufacturing Intelligence System (MIS) ===")
    
    # Ensure current working directory is on python path
    sys.path.append(os.path.abspath(os.path.dirname(__file__)))

    # 1. Initialize and Seed database if needed
    try:
        from backend.seed import seed_db
        seed_db()
    except Exception as e:
        print(f"Database initialization failed: {e}")
        sys.exit(1)
        
    # 2. Start FastAPI Web Server
    print("\nLaunching MIS Dashboard Server at http://localhost:8000 ...")
    print("Press Ctrl+C to stop the server.\n")
    try:
        subprocess.run(
            [sys.executable, "-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", "8000"],
            check=True
        )
    except KeyboardInterrupt:
        print("\nStopping server.")
    except Exception as e:
        print(f"Failed to start server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
