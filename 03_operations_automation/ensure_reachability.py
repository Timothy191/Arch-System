#!/usr/bin/env python3
"""
Arch-System LAN Reachability Configurator

Purpose:
This script automates the configuration of Supabase and Fuxa URLs in `.env`
files and `config.toml` to point to the host's LAN IP address. It is crucial
for local development environments where services (like Supabase Edge Functions,
mobile clients, or Fuxa SCADA panels) need to be reachable from other devices
on the local network.

Usage:
  ./ensure_reachability.py [LAN_IP] [ANON_KEY] [SERVICE_KEY]

If no arguments are provided, it attempts to dynamically detect the active LAN IP.
If detection fails (e.g. returns a loopback address), it will prompt the user to
manually enter the IP.
"""

import os
import re
import socket
import sys
import shutil
import secrets

# Paths
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ROOT_ENV = os.path.join(REPO_ROOT, ".env")
PORTAL_ENV = os.path.join(REPO_ROOT, "00_applications/portal", ".env")
SUPABASE_CONFIG = os.path.join(REPO_ROOT, "01_platform_packages/supabase", "config.toml")

def get_primary_ip():
    """Detects the host's primary outgoing LAN IP address."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Connect to a public resolver (does not send packets, just gets routing IP)
        s.connect(('8.8.8.8', 1))
        ip = s.getsockname()[0]
    except Exception as e:
        print(f"Error detecting outgoing IP: {e}")
        # Fallback to general hostname resolution
        try:
            ip = socket.gethostbyname(socket.gethostname())
        except Exception:
            ip = '127.0.0.1'
    finally:
        s.close()
    return ip

def generate_dummy_jwt(role="anon"):
    """Generates a dummy HS256 JWT structure for local development if keys are missing."""
    header = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" # {"alg":"HS256","typ":"JWT"}
    if role == "anon":
        payload = "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlZmF1bHQiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYwMDAwMDAwMCwiZXhwIjoyMDAwMDAwMDAwfQ"
    else:
        payload = "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlZmF1bHQiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjIwMDAwMDAwMDB9"
    signature = secrets.token_urlsafe(32).replace('-', '').replace('_', '')[:43]
    return f"{header}.{payload}.{signature}"

def update_file(file_path, replacements):
    """Safely updates a file by applying a list of regex patterns and backups."""
    if not os.path.exists(file_path):
        print(f"[-] File not found: {file_path} (skipping)")
        return False

    # Create a backup
    backup_path = file_path + ".bak"
    shutil.copy2(file_path, backup_path)
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content
    for pattern, replacement in replacements:
        content = re.sub(pattern, replacement, content)

    if content == original_content:
        print(f"[~] No updates needed for {os.path.basename(file_path)}")
        os.remove(backup_path) # Remove backup if no change made
        return False

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print(f"[+] Successfully updated {os.path.basename(file_path)} (Backup saved to {os.path.basename(backup_path)})")
    return True

def main():
    print("=" * 60)
    print("          ARCH-SYSTEMS LAN REACHABILITY CONFIGURATOR          ")
    print("=" * 60)

    # 1. Detect or use provided IP
    anon_key = None
    service_key = None

    if len(sys.argv) > 1:
        lan_ip = sys.argv[1]
        print(f"[*] Using provided IP Address: {lan_ip}")
        if len(sys.argv) > 2:
            anon_key = sys.argv[2]
        if len(sys.argv) > 3:
            service_key = sys.argv[3]
    else:
        lan_ip = get_primary_ip()
        if lan_ip == '127.0.0.1' or lan_ip.startswith('127.'):
            print("[-] Warning: Loopback IP detected. This will not be reachable on the LAN.")
            manual_ip = input("Please manually enter your LAN IP (or press Enter to keep 127.0.0.1): ").strip()
            if manual_ip:
                lan_ip = manual_ip
        
        print(f"[*] Configured Target IP Address: {lan_ip}")

        # Optionally prompt to generate dummy keys if not passing args
        if not anon_key or not service_key:
            gen_keys = input("Do you want to generate dummy Supabase keys for local development? (y/N): ").strip().lower()
            if gen_keys == 'y':
                anon_key = generate_dummy_jwt("anon")
                service_key = generate_dummy_jwt("service_role")
                print("[+] Dummy keys generated for local development.")

    # 2. Prepare replacement rules
    # .env rules (Root and Portal)
    env_replacements = [
        (r'(NEXT_PUBLIC_SUPABASE_URL\s*=\s*https?://)[^/:]+', r'\g<1>' + lan_ip),
        (r'(SUPABASE_SITE_URL\s*=\s*https?://)[^/:]+', r'\g<1>' + lan_ip),
        (r'(SUPABASE_API_URL\s*=\s*https?://)[^/:]+', r'\g<1>' + lan_ip),
        (r'(NEXT_PUBLIC_FUXA_URL\s*=\s*https?://)[^/:]+', r'\g<1>' + lan_ip)
    ]

    if anon_key:
        print("[*] Also updating Supabase Anon Keys...")
        env_replacements.append((r'(NEXT_PUBLIC_SUPABASE_ANON_KEY\s*=\s*)[^\s#\n]+', r'\g<1>' + anon_key))
        env_replacements.append((r'(SUPABASE_ANON_KEY\s*=\s*)[^\s#\n]+', r'\g<1>' + anon_key))

    if service_key:
        print("[*] Also updating Supabase Service Key...")
        env_replacements.append((r'(SUPABASE_SERVICE_KEY\s*=\s*)[^\s#\n]+', r'\g<1>' + service_key))

    # config.toml rules (Supabase config)
    supabase_replacements = [
        (r'(api_url\s*=\s*"https?://)[^/"]+', r'\g<1>' + lan_ip)
    ]

    # 3. Apply updates
    updated_any = False
    updated_any |= update_file(ROOT_ENV, env_replacements)
    updated_any |= update_file(PORTAL_ENV, env_replacements)
    updated_any |= update_file(SUPABASE_CONFIG, supabase_replacements)

    print("-" * 60)
    if updated_any:
        print(f"[!] Reachability config updated to IP: {lan_ip}")
        print("[!] Remember to sync these changes with deploy or local scripts if needed.")
        print("[!] Restart your Next.js and Supabase servers to apply changes.")
    else:
        print(f"[✓] Configurations are already correct for IP: {lan_ip}")
    print("=" * 60)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[-] Operation cancelled.")
        sys.exit(1)
