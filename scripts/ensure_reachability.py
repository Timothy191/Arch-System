#!/usr/bin/env python3
import os
import re
import socket
import sys
import shutil

# Paths
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ROOT_ENV = os.path.join(REPO_ROOT, ".env")
PORTAL_ENV = os.path.join(REPO_ROOT, "apps/portal", ".env")
SUPABASE_CONFIG = os.path.join(REPO_ROOT, "packages/supabase", "config.toml")

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
            print("[-] Warning: Loopback IP detected. Please connect to Wi-Fi/Ethernet.")
            sys.exit(1)
        print(f"[*] Detected Host LAN IP Address: {lan_ip}")

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
        print("[!] Restart your Next.js and Supabase servers to apply changes.")
    else:
        print(f"[✓] Configurations are already correct for IP: {lan_ip}")
    print("=" * 60)

if __name__ == "__main__":
    main()
