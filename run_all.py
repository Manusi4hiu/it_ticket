import subprocess
import os
import sys
import signal

def run_command(command, cwd):
    """Runs a command in a specific directory and returns the process."""
    return subprocess.Popen(command, shell=True, cwd=cwd)

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(root_dir, 'backend')
    frontend_dir = os.path.join(root_dir, 'frontend')

    # Command for backend (Windows specific venv)
    backend_cmd = r'.\venv\Scripts\activate && python run.py'
    
    # Command for frontend
    frontend_cmd = 'npm run dev'

    print("Starting IT Ticket Project...")
    
    processes = []
    
    try:
        print(f"Starting Backend in: {backend_dir}")
        backend_proc = run_command(backend_cmd, backend_dir)
        processes.append(backend_proc)

        print(f"Starting Frontend in: {frontend_dir}")
        frontend_proc = run_command(frontend_cmd, frontend_dir)
        processes.append(frontend_proc)

        print("\nBoth servers are running!")
        print("Press Ctrl+C to stop both servers.\n")

        # Keep the script running until interrupted
        while True:
            for proc in processes:
                if proc.poll() is not None:
                    print(f"\nProcess {proc.pid} exited with code {proc.returncode}")
                    return
    
    except KeyboardInterrupt:
        print("\n\nStopping servers...")
        for proc in processes:
            # On Windows, taskkill is more reliable for killing process trees
            subprocess.run(['taskkill', '/F', '/T', '/PID', str(proc.pid)], capture_output=True)
            print(f"Stopped process {proc.pid}")
        print("Done.")

if __name__ == "__main__":
    main()
