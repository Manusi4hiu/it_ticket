import subprocess
import os
import sys
import threading
import time
from datetime import datetime

# ANSI Colors for terminal
class Colors:
    CYAN = '\033[96m'
    YELLOW = '\033[93m'
    GREEN = '\033[92m'
    RED = '\033[91m'
    BOLD = '\033[1m'
    END = '\033[0m'

def log_stream(stream, prefix, color):
    """Reads a stream and prints it with a colored prefix and timestamp."""
    try:
        for line in iter(stream.readline, ''):
            if line:
                timestamp = datetime.now().strftime("%H:%M:%S")
                # Remove extra whitespace and print with prefix
                clean_line = line.strip()
                if clean_line:
                    print(f"{color}[{timestamp}] {prefix} | {clean_line}{Colors.END}")
    except Exception:
        pass
    finally:
        stream.close()

def run_command(command, cwd, prefix, color):
    """Runs a command and starts threads to log its output."""
    process = subprocess.Popen(
        command,
        shell=True,
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
        encoding='utf-8',
        errors='replace'
    )
    
    # Start threads to handle stdout and stderr separately
    stdout_thread = threading.Thread(target=log_stream, args=(process.stdout, prefix, color))
    stderr_thread = threading.Thread(target=log_stream, args=(process.stderr, f"{prefix}_ERR", Colors.RED))
    
    stdout_thread.daemon = True
    stderr_thread.daemon = True
    
    stdout_thread.start()
    stderr_thread.start()
    
    return process

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(root_dir, 'backend')
    frontend_dir = os.path.join(root_dir, 'frontend')

    # Command for backend (Windows specific venv)
    backend_cmd = r'.\venv\Scripts\activate && python run.py'
    
    # Command for frontend
    frontend_cmd = 'npm run dev'

    # Enable ANSI escape sequences on Windows 10+
    if os.name == 'nt':
        os.system('color')

    print(f"\n{Colors.BOLD}{Colors.CYAN}🚀 STARTING IT TICKET PROJECT...{Colors.END}")
    print(f"{Colors.CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{Colors.END}")
    
    processes = []
    
    try:
        print(f"{Colors.CYAN}📂 Backend: {backend_dir}{Colors.END}")
        backend_proc = run_command(backend_cmd, backend_dir, "BACKEND ", Colors.CYAN)
        processes.append(("BACKEND", backend_proc))

        print(f"{Colors.YELLOW}📂 Frontend: {frontend_dir}{Colors.END}")
        frontend_proc = run_command(frontend_cmd, frontend_dir, "FRONTEND", Colors.YELLOW)
        processes.append(("FRONTEND", frontend_proc))

        print(f"\n{Colors.GREEN}✅ Both servers are starting up!{Colors.END}")
        print(f"{Colors.BOLD}Press Ctrl+C to stop both servers.{Colors.END}")
        print(f"{Colors.CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n{Colors.END}")

        # Keep the script running until interrupted or a process crashes
        while True:
            for name, proc in processes:
                if proc.poll() is not None:
                    print(f"\n{Colors.RED}❌ CRITICAL ERROR: {name} (PID {proc.pid}) exited unexpectedly with code {proc.returncode}{Colors.END}")
                    return
            time.sleep(1)
    
    except KeyboardInterrupt:
        print(f"\n\n{Colors.RED}🛑 Stopping servers...{Colors.END}")
        for name, proc in processes:
            print(f"Stopping {name} (PID {proc.pid})...")
            # On Windows, taskkill is more reliable for killing process trees
            subprocess.run(['taskkill', '/F', '/T', '/PID', str(proc.pid)], capture_output=True)
        print(f"{Colors.GREEN}Done.{Colors.END}")

if __name__ == "__main__":
    main()

