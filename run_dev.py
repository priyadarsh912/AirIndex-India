"""
AirIndex India - Local Development Orchestrator
Starts both the FastAPI backend (Port 8000) and the Vite React frontend (Port 3000) concurrently.
"""

import os
import sys
import subprocess
import time
import signal

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")

processes = []

def cleanup(signum=None, frame=None):
    print("\n[AirIndex Dev] Shutting down services...")
    for p in processes:
        try:
            p.terminate()
            p.wait(timeout=3)
        except Exception:
            try:
                p.kill()
            except Exception:
                pass
    sys.exit(0)

signal.signal(signal.SIGINT, cleanup)
signal.signal(signal.SIGTERM, cleanup)

def main():
    print("=" * 65)
    print("AirIndex India -- Launching Integrated Local Development Stack")
    print("    * Backend Service:  http://localhost:8000")
    print("    * Frontend Portal:  http://localhost:3000")
    print("=" * 65)

    # 1. Start FastAPI Backend
    print("\n[1/2] Starting FastAPI Backend on port 8000...")
    backend_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"],
        cwd=BACKEND_DIR,
        shell=False
    )
    processes.append(backend_proc)

    # Allow backend 4 seconds to initialize and connect to Supabase
    time.sleep(4)

    # 2. Start Vite Frontend
    print("[2/2] Starting Vite React Frontend on port 3000...")
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
    frontend_proc = subprocess.Popen(
        [npm_cmd, "run", "dev"],
        cwd=FRONTEND_DIR,
        shell=False
    )
    processes.append(frontend_proc)

    print("\n" + "=" * 65)
    print("Stack is active! Open http://localhost:3000 in your browser.")
    print("Press Ctrl+C at any time to stop all services.")
    print("=" * 65 + "\n")

    try:
        while True:
            # Check if any process died unexpectedly
            for p in processes:
                ret = p.poll()
                if ret is not None:
                    print(f"[Warning] A service exited with code {ret}. Shutting down.")
                    cleanup()
            time.sleep(1)
    except KeyboardInterrupt:
        cleanup()

if __name__ == "__main__":
    main()
