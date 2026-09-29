#!/bin/bash
# Deployment Troubleshooting Script for aaPanel Server
# Run this ON THE AAPANEL SERVER

echo "=== IT Ticket Deployment Diagnostics ==="
echo ""

# 1. Check public IP
echo "1. Server Public IP:"
PUBLIC_IP=$(curl -s ifconfig.me || curl -s icanhazip.com || echo "Could not detect")
echo "   $PUBLIC_IP"
echo "   ⚠️  Use this IP in GitHub Secrets -> SERVER_IP"
echo ""

# 2. Check SSH service
echo "2. SSH Service Status:"
systemctl is-active sshd || systemctl is-active ssh
SSH_PORT=$(netstat -tlnp 2>/dev/null | grep sshd | awk '{print $4}' | cut -d':' -f2 | head -1)
if [ -z "$SSH_PORT" ]; then
    SSH_PORT=$(ss -tlnp 2>/dev/null | grep sshd | awk '{print $5}' | cut -d':' -f2 | head -1)
fi
echo "   SSH Port: ${SSH_PORT:-22}"
echo "   ⚠️  Use this in GitHub Secrets -> SERVER_PORT"
echo ""

# 3. Check firewall
echo "3. Firewall Status:"
if command -v ufw &> /dev/null; then
    echo "   UFW Status:"
    ufw status | grep -E "Status|${SSH_PORT:-22}"
elif command -v firewall-cmd &> /dev/null; then
    echo "   Firewalld Status:"
    firewall-cmd --state
    firewall-cmd --list-ports | grep ${SSH_PORT:-22}
else
    echo "   No firewall detected (ufw/firewalld)"
fi
echo ""

# 4. Check listening ports
echo "4. SSH Listening:"
netstat -tlnp 2>/dev/null | grep -E ":${SSH_PORT:-22}" || ss -tlnp 2>/dev/null | grep -E ":${SSH_PORT:-22}"
echo ""

# 5. Check deployment directory
echo "5. Deployment Directory:"
DEPLOY_DIR="/www/wwwroot/staging.ani.co.id/it_ticket"
if [ -d "$DEPLOY_DIR" ]; then
    echo "   ✅ $DEPLOY_DIR exists"
    ls -la "$DEPLOY_DIR"
else
    echo "   ❌ $DEPLOY_DIR does not exist"
    echo "   Creating directory..."
    mkdir -p "$DEPLOY_DIR"
    chmod 755 "$DEPLOY_DIR"
fi
echo ""

# 6. Check SSH authorized_keys
echo "6. SSH Authorization:"
if [ -f ~/.ssh/authorized_keys ]; then
    KEY_COUNT=$(grep -c "^ssh-" ~/.ssh/authorized_keys 2>/dev/null || echo "0")
    echo "   ✅ ~/.ssh/authorized_keys exists"
    echo "   Keys: $KEY_COUNT"
    chmod 600 ~/.ssh/authorized_keys
else
    echo "   ❌ No ~/.ssh/authorized_keys"
    mkdir -p ~/.ssh
    chmod 700 ~/.ssh
    touch ~/.ssh/authorized_keys
    chmod 600 ~/.ssh/authorized_keys
fi
echo ""

# 7. Test from external
echo "7. External SSH Test:"
echo "   Run from your LOCAL machine (not server):"
echo "   ssh -v -p ${SSH_PORT:-22} $(whoami)@$PUBLIC_IP"
echo ""

# 8. GitHub Actions IP Ranges
echo "8. GitHub Actions IP Ranges to Whitelist:"
echo "   GitHub uses Azure IPs. Get latest from:"
echo "   https://api.github.com/meta"
echo ""
echo "   Example UFW rules:"
echo "   ufw allow from 20.26.156.0/23 to any port ${SSH_PORT:-22}"
echo "   ufw allow from 20.102.36.0/23 to any port ${SSH_PORT:-22}"
echo "   (Add all ranges from GitHub meta API)"
echo ""

# 9. Quick fix commands
echo "9. Quick Fix Commands:"
echo ""
echo "   # Open SSH port (UFW):"
echo "   ufw allow ${SSH_PORT:-22}/tcp"
echo "   ufw reload"
echo ""
echo "   # Open SSH port (Firewalld):"
echo "   firewall-cmd --add-port=${SSH_PORT:-22}/tcp --permanent"
echo "   firewall-cmd --reload"
echo ""
echo "   # Generate GitHub Actions SSH key:"
echo "   ssh-keygen -t ed25519 -C 'github-actions' -f ~/.ssh/github_deploy -N ''"
echo "   cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys"
echo "   echo ''"
echo "   echo 'Copy this private key to GitHub Secrets -> SERVER_SSH_KEY:'"
echo "   cat ~/.ssh/github_deploy"
echo ""

echo "=== Diagnostics Complete ==="
