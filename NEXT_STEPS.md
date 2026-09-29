# Deployment Status & Next Steps

## ✅ SUDAH SELESAI (di Repository)

1. **Frontend build fixed** - Missing @radix-ui dependencies sudah ditambahkan
2. **Deployment workflow improved** - Script restart lebih robust
3. **Documentation** - DEPLOYMENT_FIX.md dan troubleshooting script

## ❌ MASIH PERLU KAMU FIX (di Server aaPanel)

### Masalah Saat Ini
GitHub Actions **tidak bisa connect** ke server aaPanel:
```
error: dial tcp [IP]:[PORT]: i/o timeout
```

Ini bukan masalah SSH key - ini masalah **network/firewall**.

### Yang Perlu Dilakukan

#### 1. SSH ke Server aaPanel Kamu
```bash
ssh root@your-server-ip
# atau
ssh www@your-server-ip
```

#### 2. Jalankan Script Diagnostik
```bash
# Di server aaPanel
cd /tmp
curl -O https://raw.githubusercontent.com/Manusi4hiu/it_ticket/main/deployment-troubleshoot.sh
chmod +x deployment-troubleshoot.sh
./deployment-troubleshoot.sh
```

Script akan check:
- Public IP yang benar (untuk SERVER_IP secret)
- SSH port (untuk SERVER_PORT secret)
- Firewall status
- Directory permissions
- SSH keys

#### 3. Buka Port SSH di Firewall

**Jika pakai UFW:**
```bash
ufw allow 22/tcp
ufw reload
ufw status
```

**Jika pakai Firewalld:**
```bash
firewall-cmd --add-port=22/tcp --permanent
firewall-cmd --reload
```

**Jika pakai Cloud Provider (AWS/GCP/Azure/Alibaba):**
- Login ke dashboard cloud provider
- Buka Security Groups / Firewall Rules
- Tambah inbound rule: Port 22 (SSH) dari 0.0.0.0/0
- Atau whitelist GitHub Actions IP ranges: https://api.github.com/meta

#### 4. Generate & Setup SSH Key
```bash
# Di server aaPanel
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_deploy -N ""
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Copy private key untuk GitHub Secrets
cat ~/.ssh/github_deploy
```

#### 5. Update GitHub Secrets
Buka: https://github.com/Manusi4hiu/it_ticket/settings/secrets/actions

Update/Buat secrets ini:

**SERVER_IP**: Public IP dari langkah 2 (hasil script diagnostik)
**SERVER_PORT**: SSH port dari langkah 2 (biasanya 22)
**SERVER_USERNAME**: Username SSH (root atau www)
**SERVER_SSH_KEY**: Private key dari langkah 4 (SELURUH output dari `cat ~/.ssh/github_deploy`)

#### 6. Test Manual dari Local
Sebelum push lagi, test SSH manual dari komputer lokal:
```bash
ssh -i path/to/private/key -p PORT USERNAME@PUBLIC_IP
```

Kalau berhasil manual, berarti GitHub Actions juga akan berhasil.

#### 7. Push & Test
Setelah semua setup, push commit apapun untuk trigger deployment.

---

## Troubleshooting

**Jika masih timeout setelah firewall dibuka:**
- Pastikan cloud provider security group juga dibuka
- Cek apakah server pakai NAT/behind load balancer
- Pertimbangkan pakai self-hosted runner di network yang sama

**Jika "Permission denied":**
- Cek ownership: `chown -R www:www /www/wwwroot/staging.ani.co.id/it_ticket`
- Atau deploy pakai user root

**Jika "No such file or directory":**
- Buat manual: `mkdir -p /www/wwwroot/staging.ani.co.id/it_ticket`

---

## Need Help?
Jalankan script diagnostik dulu, screenshot outputnya, terus kasih tau saya hasilnya.
