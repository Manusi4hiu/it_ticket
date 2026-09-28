# Cara Perbaiki Deployment ke aaPanel

## Masalah Saat Ini
- ✅ Build frontend berhasil (radix-ui dependencies sudah fix)
- ❌ SSH connection ke server gagal

## Langkah Perbaikan

### 1. Cek/Buat SSH Key di Server aaPanel

SSH ke server aaPanel kamu, lalu:

```bash
# Generate SSH key pair (jika belum ada)
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_deploy

# Tambahkan public key ke authorized_keys
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Copy private key untuk GitHub Secrets
cat ~/.ssh/github_deploy
```

### 2. Set GitHub Secrets

Buka: https://github.com/Manusi4hiu/it_ticket/settings/secrets/actions

Pastikan secrets ini sudah benar:

**SERVER_SSH_KEY**
```
-----BEGIN OPENSSH PRIVATE KEY-----
(paste SELURUH isi private key dari langkah 1)
-----END OPENSSH PRIVATE KEY-----
```
⚠️ PENTING: Copy dari `-----BEGIN` sampai `-----END` termasuk newline

**SERVER_IP**
```
IP.address.server.kamu
```

**SERVER_USERNAME**
```
root
atau
www
```
(sesuai user aaPanel)

**SERVER_PORT** (optional, default 22)
```
22
atau
port_ssh_custom_kamu
```

### 3. Cek Firewall Server

Pastikan server bisa diakses dari GitHub Actions:

```bash
# Di server aaPanel
# Cek port SSH terbuka
netstat -tlnp | grep ssh

# Tambahkan rule firewall jika perlu (untuk aaPanel biasanya pakai ufw atau firewalld)
# Contoh ufw:
ufw allow 22/tcp
ufw reload

# Atau jika pakai security group cloud (AWS/GCP/Azure)
# Buka port 22 untuk IP 0.0.0.0/0 atau range IP GitHub Actions
```

### 4. Test Koneksi Secara Manual

Dari komputer lokal, test SSH:

```bash
ssh -i /path/to/private_key username@server_ip -p port
```

Jika berhasil, berarti konfigurasi sudah benar.

### 5. Cek Nama Service di aaPanel

Setelah deployment berhasil copy files, pastikan nama PM2 dan service backend sesuai:

```bash
# Di server
pm2 list
# Cari nama aplikasi frontend kamu

supervisorctl status
# atau
systemctl list-units | grep ticket
# Cari nama service backend kamu
```

Update nama di `.github/workflows/deploy.yml` baris 63 dan 71 jika berbeda:
- `it_ticket_frontend` → nama PM2 app kamu
- `it_ticket_backend` → nama supervisor/systemctl service kamu

### 6. Push & Test Ulang

Setelah semua secrets benar dan firewall terbuka, push commit apapun untuk trigger deployment ulang.

## Troubleshooting

**Jika masih timeout:**
- Cek apakah GitHub Actions IP di-block firewall
- GitHub Actions pakai IP dinamis, whitelist range IP GitHub: https://api.github.com/meta (lihat bagian "actions")
- Atau gunakan self-hosted runner di network yang sama dengan server

**Jika "Permission denied":**
- Pastikan user punya akses ke `/www/wwwroot/staging.ani.co.id/it_ticket`
- Atau gunakan sudo di script deployment (butuh NOPASSWD di sudoers)
