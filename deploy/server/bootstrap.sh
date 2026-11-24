#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 24.04 EC2 server for YouMart (run as root, via Session Manager):
#   sudo bash bootstrap.sh
# Installs Docker + Compose and the AWS CLI, adds 4 GB swap, sets the time zone, creates
# /opt/youmart and schedules the nightly database backup. Safe to run again.
set -euo pipefail

echo '== time zone: Asia/Kolkata (cron times below are IST)'
timedatectl set-timezone Asia/Kolkata

echo '== Docker Engine + Compose plugin'
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker
# Let the default "ubuntu" user run docker without sudo.
usermod -aG docker ubuntu || true

echo '== AWS CLI (backups to S3 use the instance IAM role - no keys on disk)'
if ! command -v aws >/dev/null; then
  snap install aws-cli --classic
fi

echo '== 4 GB swap (headroom for search reindexes and deploys)'
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
sysctl -w vm.swappiness=10
grep -q '^vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=10' >> /etc/sysctl.conf

echo '== app folder'
mkdir -p /opt/youmart/certs /opt/youmart/backups
chown -R ubuntu:ubuntu /opt/youmart
chmod 700 /opt/youmart/certs

echo '== nightly database backup at 03:30 IST'
cat > /etc/cron.d/youmart-backup <<'CRON'
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin
30 3 * * * ubuntu /opt/youmart/server/backup.sh >> /opt/youmart/backups/backup.log 2>&1
CRON
chmod 644 /etc/cron.d/youmart-backup

echo '== done. Next: copy the deploy/ folder to /opt/youmart (deploy/README.md, step 7).'
