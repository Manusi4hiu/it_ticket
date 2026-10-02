# FIX GITHUB ACTIONS TIMEOUT - IT TICKET

## Masalah Saat Ini
```
❌ error copy file to dest: dial tcp ***:***: i/o timeout
```

Semua 10 deployment terakhir GAGAL di step "Copy Files to Server"

---

## SOLUSI 1: BUKA FIREWALL SERVER (RECOMMENDED)

### A. SSH ke Server aaPanel

```bash
ssh root@staging.ani.co.id
# atau
ssh root@IP_SERVER
```

### B. Cek Status SSH & Firewall

Jalankan script diagnostik:

```bash
curl -sL https://raw.githubusercontent.com/Manusi4hiu/it_ticket/main/deployment-troubleshoot.sh | bash
```

Atau manual:

```bash
# Cek SSH service
systemctl status sshd

# Cek port SSH
netstat -tlnp | grep sshd

# Cek firewall
ufw status
# atau
firewall-cmd --list-all
```

### C. Buka Port SSH untuk GitHub Actions

**Jika pakai UFW:**

```bash
# Buka port SSH untuk semua (TEMPORARY TEST)
sudo ufw allow 22/tcp
sudo ufw reload

# Test dulu, kalau berhasil, nanti restrict ke GitHub IP ranges
```

**Jika pakai Firewalld:**

```bash
sudo firewall-cmd --add-port=22/tcp --permanent
sudo firewall-cmd --reload
```

**Jika pakai aaPanel Security:**

1. Login aaPanel web panel → Security
2. Tambahkan rule: Port 22, Source: 0.0.0.0/0 (atau GitHub IP ranges)
3. Save

**Jika pakai Cloud Provider (AWS/GCP/DigitalOcean):**

1. Masuk console cloud provider
2. Cari Security Group / Firewall Rules
3. Tambah inbound rule:
   - Port: 22
   - Protocol: TCP
   - Source: 0.0.0.0/0 (temporary) atau GitHub IP ranges

### D. Test dari GitHub Actions Lagi

Push commit apapun untuk trigger deployment:

```bash
git commit --allow-empty -m "test: trigger deployment after firewall fix"
git push origin main
```

---

## SOLUSI 2: WHITELIST GITHUB ACTIONS IP (SECURE)

Kalau solusi 1 berhasil, sekarang restrict ke IP GitHub saja:

### A. Get GitHub Actions IP Ranges

```bash
curl -s https://api.github.com/meta | jq -r '.actions[]'
```

Output contoh:
```
20.26.156.0/23
20.102.36.0/23
20.150.147.0/24
20.157.77.0/24
... (puluhan range)
```

### B. Tambahkan ke Firewall

**UFW:**

```bash
# Hapus rule 0.0.0.0/0 dulu
sudo ufw delete allow 22/tcp

# Tambah setiap range GitHub
sudo ufw allow from 20.26.156.0/23 to any port 22
sudo ufw allow from 20.102.36.0/23 to any port 22
# ... dst untuk semua range

sudo ufw reload
```

**Script otomatis:**

```bash
# Buat script whitelist-github.sh
cat > /tmp/whitelist-github.sh << 'EOF'
#!/bin/bash
# Hapus old rules dulu jika ada
ufw delete allow 22/tcp 2>/dev/null

# Get GitHub IP ranges
GH_IPS=$(curl -s https://api.github.com/meta | jq -r '.actions[]')

# Add each range
echo "$GH_IPS" | while read ip; do
  echo "Adding $ip..."
  ufw allow from $ip to any port 22
done

ufw reload
echo "GitHub Actions IPs whitelisted!"
EOF

chmod +x /tmp/whitelist-github.sh
sudo /tmp/whitelist-github.sh
```

---

## SOLUSI 3: PAKAI SELF-HOSTED RUNNER (ALTERNATIVE)

Kalau firewall tetap tidak bisa dibuka (policy ketat), pakai GitHub self-hosted runner di server yang sama network dengan aaPanel.

### Setup Self-Hosted Runner

1. **Di GitHub repo:**
   - Settings → Actions → Runners → New self-hosted runner
   - Pilih Linux
   - Copy command yang dikasih

2. **Di server yang bisa akses aaPanel:**

```bash
# Install runner
mkdir actions-runner && cd actions-runner
curl -o actions-runner-linux-x64-2.319.1.tar.gz -L https://github.com/actions/runner/releases/download/v2.319.1/actions-runner-linux-x64-2.319.1.tar.gz
tar xzf ./actions-runner-linux-x64-2.319.1.tar.gz

# Configure (paste command dari GitHub)
./config.sh --url https://github.com/Manusi4hiu/it_ticket --token YOUR_TOKEN

# Run as service
sudo ./svc.sh install
sudo ./svc.sh start
```

3. **Update workflow:**

```yaml
# .github/workflows/deploy.yml
jobs:
  deploy:
    runs-on: self-hosted  # Ganti dari ubuntu-latest
```

---

## SOLUSI 4: PERBAIKI SSH KEY (JIKA MASIH GAGAL)

### A. Generate New SSH Key di Server

```bash
# Di server aaPanel
ssh-keygen -t ed25519 -C "github-actions-it-ticket" -f ~/.ssh/github_deploy -N ''

# Add to authorized_keys
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Show private key untuk copy
cat ~/.ssh/github_deploy
```

### B. Update GitHub Secret

1. Copy SELURUH output `cat ~/.ssh/github_deploy` (dari `-----BEGIN` sampai `-----END`)
2. Buka: https://github.com/Manusi4hiu/it_ticket/settings/secrets/actions
3. Edit `SERVER_SSH_KEY`
4. Paste private key, pastikan ada newline di akhir
5. Save

---

## SOLUSI 5: INCREASE TIMEOUT (QUICK FIX)

Update workflow timeout dari 30s jadi 120s:

```yaml
# .github/workflows/deploy.yml line 44
- name: Copy Files to Server
  uses: appleboy/scp-action@v0.1.7
  with:
    host: ${{ secrets.SERVER_IP }}
    username: ${{ secrets.SERVER_USERNAME }}
    key: ${{ secrets.SERVER_SSH_KEY }}
    port: ${{ secrets.SERVER_PORT || 22 }}
    timeout: 120s  # ← TAMBAH INI (default 30s)
    command_timeout: 10m
    source: "frontend/build/,frontend/package.json,frontend/pnpm-lock.yaml,backend/"
    target: "/www/wwwroot/staging.ani.co.id/it_ticket"
    strip_components: 0
```

---

## CHECKLIST DEBUGGING

Jalankan satu per satu sampai berhasil:

- [ ] Test SSH dari local: `ssh -v root@staging.ani.co.id`
- [ ] Cek firewall server dengan script diagnostik
- [ ] Buka port 22 untuk 0.0.0.0/0 (test)
- [ ] Push commit kosong, cek GitHub Actions
- [ ] Jika berhasil → whitelist GitHub IP ranges
- [ ] Jika masih gagal → regenerate SSH key
- [ ] Jika masih gagal → increase timeout
- [ ] Last resort → setup self-hosted runner

---

## CARA TEST MANUAL (TANPA GITHUB ACTIONS)

Dari komputer lokal, test koneksi:

```bash
# Test 1: Ping server
ping staging.ani.co.id

# Test 2: Check port terbuka
nc -zv staging.ani.co.id 22
# atau
telnet staging.ani.co.id 22

# Test 3: SSH dengan verbose
ssh -v root@staging.ani.co.id

# Test 4: SCP file test (simulasi GitHub Actions)
echo "test" > test.txt
scp -v test.txt root@staging.ani.co.id:/tmp/
```

Kalau semua test ini GAGAL → masalah di server/firewall
Kalau test ini SUKSES tapi GitHub Actions gagal → masalah di GitHub Actions IP yang di-block

---

## EXPECTED OUTPUT SETELAH FIX

```
✅ deploy  Copy Files to Server
   drone-scp version: v1.6.14
   tar all files into /tmp/xxx.tar.gz
   remote server os type is unix
   scp file to server.
   copy file to dest: /www/wwwroot/staging.ani.co.id/it_ticket
   
✅ deploy  Restart Services on aaPanel
   PM2 restart successful
   Backend restart successful
```

---

## KONTAK JIKA MASIH GAGAL

Kalau semua solusi di atas sudah dicoba tapi masih timeout:

1. Share output dari:
   ```bash
   # Di server
   curl -sL https://raw.githubusercontent.com/Manusi4hiu/it_ticket/main/deployment-troubleshoot.sh | bash
   ```

2. Share screenshot GitHub Actions log terbaru

3. Konfirmasi:
   - Provider server (AWS/GCP/DigitalOcean/VPS biasa?)
   - Apakah bisa SSH dari komputer sendiri?
   - Apakah ada cloud firewall/security group?
