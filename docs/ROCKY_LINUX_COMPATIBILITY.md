# Rocky Linux Compatibility Guide

## Overview

The `setup-production-environment.sh` script has been analyzed for Rocky Linux compatibility. This document outlines the compatibility status and any manual steps required for Rocky Linux deployments.

## Compatibility Status: ✅ Mostly Compatible

The script is largely compatible with Rocky Linux, but some manual prerequisites and configuration may be needed.

## Prerequisites for Rocky Linux

### 1. System Packages

Install required system packages using dnf:

```bash
# Update system
sudo dnf update -y

# Install basic utilities
sudo dnf install -y git curl wget vim bash-completion

# Install Node.js 22 (NodeSource repository)
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo dnf install -y nodejs

# Install pnpm
npm install -g pnpm@9.15.9

# Install Redis
sudo dnf install -y redis
sudo systemctl enable --now redis

# Install Docker
sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo systemctl enable --now docker

# Add current user to docker group
sudo usermod -aG docker $USER
# Log out and back in for group change to take effect
```

### 2. Firewall Configuration

Rocky Linux uses firewalld by default. Configure firewall to allow required ports:

```bash
# Allow HTTP/HTTPS
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https

# Allow application ports
sudo firewall-cmd --permanent --add-port=3000/tcp   # Next.js Portal
sudo firewall-cmd --permanent --add-port=5678/tcp   # n8n
sudo firewall-cmd --permanent --add-port=6333/tcp   # Qdrant
sudo firewall-cmd --permanent --add-port=8123/tcp   # ClickHouse
sudo firewall-cmd --permanent --add-port=9090/tcp   # Prometheus
sudo firewall-cmd --permanent --add-port=3001/tcp   # Grafana
sudo firewall-cmd --permanent --add-port=8080/tcp   # cAdvisor

# Reload firewall
sudo firewall-cmd --reload
```

### 3. SELinux Configuration

SELinux is enabled by default on Rocky Linux. You may need to adjust contexts:

```bash
# Check SELinux status
sestatus

# For development, you can set to permissive mode (NOT recommended for production)
sudo setenforce 0
# To make permanent, edit /etc/selinux/config and set SELINUX=permissive

# For production, create proper policies instead
# Example: Allow httpd to connect to network
sudo setsebool -P httpd_can_network_connect 1
```

### 4. Systemd Service Adjustments

The systemd service file created by the script should work on Rocky Linux, but ensure proper file contexts:

```bash
# If you encounter SELinux issues with the service file:
sudo restorecon -R /etc/systemd/system/
sudo systemctl daemon-reload
```

## Script Compatibility Notes

### ✅ Works Automatically

- **Node.js version detection**: Standard version comparison works
- **pnpm detection**: Standard command detection
- **Docker detection**: Standard Docker checks work
- **systemd detection**: Rocky Linux uses systemd by default
- **Git operations**: Standard Git commands work
- **File operations**: Standard bash file operations work
- **Environment configuration**: Standard env file handling works
- **Portal build**: pnpm build commands work identically
- **Health checks**: Standard curl commands work

### ⚠️ Manual Steps Required

- **Redis installation**: Must install Redis via dnf before running script
- **Docker installation**: Must install Docker via dnf before running script
- **Node.js 22**: Must install via NodeSource repository (not in default repos)
- **Firewall rules**: Must configure firewalld manually
- **SELinux**: May need policy adjustments or permissive mode

### 🔄 Script Modifications Recommended

The following improvements could enhance Rocky Linux compatibility:

1. **OS Detection**: Add Rocky Linux detection for better error messages
2. **Package Installation**: Add optional dnf-based package installation
3. **Service Names**: Ensure Redis service name detection works with Rocky Linux
4. **Firewall Warnings**: Add warnings if firewalld is blocking ports
5. **SELinux Checks**: Add SELinux status checks and warnings

## Running the Script on Rocky Linux

### After Manual Setup

Once prerequisites are installed, run the script normally:

```bash
cd /path/to/Arch-Mk2
./scripts/setup-production-environment.sh
```

### Expected Behavior

1. **Prerequisites check**: Should pass if you installed Node.js 22, pnpm, and Docker
2. **Environment setup**: Should work without issues
3. **Systemd service**: Should work (Rocky Linux uses systemd)
4. **Redis**: Should detect running Redis service
5. **Docker tools**: Should work if Docker is properly installed
6. **Build and start**: Should work normally

### Troubleshooting

#### Redis Issues

If Redis fails to start:

```bash
# Check Redis status
sudo systemctl status redis

# Start Redis manually
sudo systemctl start redis

# Enable Redis on boot
sudo systemctl enable redis
```

#### Docker Issues

If Docker commands fail:

```bash
# Check Docker status
sudo systemctl status docker

# Start Docker
sudo systemctl start docker

# Check if user is in docker group
groups $USER

# If not, add user and re-login
sudo usermod -aG docker $user
```

#### Firewall Issues

If services are not accessible:

```bash
# Check firewall rules
sudo firewall-cmd --list-all

# Check if ports are open
sudo firewall-cmd --list-ports

# Add missing ports
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

#### SELinux Issues

If you encounter permission denied errors:

```bash
# Check SELinux audit logs for specific issues
sudo ausearch -m avc -ts recent

# Temporarily set to permissive mode for testing
sudo setenforce 0

# Create proper SELinux policy for production use
# (This requires advanced SELinux policy configuration)
```

## Production Considerations

### Security

1. **Don't disable SELinux** in production - create proper policies
2. **Use minimal firewall rules** - only open required ports
3. **Keep system updated** - `sudo dnf update -y`
4. **Use strong passwords** for all services
5. **Configure SSL/TLS** for all services

### Performance

1. **Configure swap** appropriately for your workload
2. **Tune kernel parameters** if needed (sysctl)
3. **Monitor system resources** using the monitoring stack
4. **Configure log rotation** to prevent disk filling

### High Availability

1. **Consider clustering** for critical services (Redis, Supabase)
2. **Configure proper backup strategies**
3. **Use load balancers** for multiple instances
4. **Monitor service health** and set up alerts

## Summary

The `setup-production-environment.sh` script is **compatible with Rocky Linux** but requires manual prerequisite installation and configuration. The main areas requiring attention are:

1. Package installation (Node.js, Redis, Docker)
2. Firewall configuration (firewalld)
3. SELinux policy configuration

Once these prerequisites are met, the script should run without issues on Rocky Linux.
