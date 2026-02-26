# Update Vercel URL and CRON_SECRET on AWS EC2

## Quick Update Commands

### 1. SSH into your EC2 instance:
```bash
ssh -i your-key.pem ec2-user@ec2-3-1-202-172.ap-southeast-1.compute.amazonaws.com
```

### 2. Update the Configuration:

**Option A: Edit with nano (easiest)**
```bash
nano ~/atlas-cron/escalation.sh
```

Change these two lines:
```bash
VERCEL_URL="https://your-new-vercel-url.vercel.app"  # ← Your actual Vercel URL
CRON_SECRET="your-new-cron-secret"                   # ← From your .env.local
```

Save: `Ctrl+X`, then `Y`, then `Enter`

---

**Option B: One-line update with sed**

Update Vercel URL:
```bash
# Replace the URL (change the URL inside the quotes)
sed -i 's|VERCEL_URL=".*"|VERCEL_URL="https://your-new-url.vercel.app"|' ~/atlas-cron/escalation.sh
```

Update CRON_SECRET:
```bash
# Replace the secret (change the secret inside the quotes)
sed -i 's|CRON_SECRET=".*"|CRON_SECRET="your-new-secret-here"|' ~/atlas-cron/escalation.sh
```

---

### 3. Verify the Changes:
```bash
cat ~/atlas-cron/escalation.sh | grep -E "VERCEL_URL|CRON_SECRET"
```

Should show:
```bash
VERCEL_URL="https://your-new-url.vercel.app"
CRON_SECRET="your-new-secret-here"
```

---

### 4. Test the Script:
```bash
~/atlas-cron/escalation.sh
```

### 5. Check the Log:
```bash
tail ~/atlas-cron/escalation.log
```

---

## Where to Find Your Values

### Vercel URL:
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click your project
3. Copy the URL (e.g., `https://atlas-helpdesk-abc123.vercel.app`)

### CRON_SECRET:
1. Check your `.env.local` file locally:
```bash
cat .env.local | grep CRON_SECRET
```

2. Or from Vercel dashboard:
   - Go to Project Settings → Environment Variables
   - Copy the `CRON_SECRET` value

---

## Full Example

```bash
# SSH into EC2
ssh -i my-key.pem ec2-user@ec2-3-1-202-172.ap-southeast-1.compute.amazonaws.com

# Edit the file
nano ~/atlas-cron/escalation.sh

# Before:
VERCEL_URL="https://old-url.vercel.app"
CRON_SECRET="old-secret-123"

# After:
VERCEL_URL="https://atlas-helpdesk-abc123.vercel.app"
CRON_SECRET="0ec58609a33d7106e7cc46bb6aacc5df43c761f31cb1a509107b5acdbfe6a89a"

# Save and test
~/atlas-cron/escalation.sh
tail ~/atlas-cron/escalation.log
```

---

## Common Issues

**Permission denied?**
```bash
chmod +x ~/atlas-cron/escalation.sh
```

**Script not found?**
```bash
ls -la ~/atlas-cron/
```

**Cron not running after update?**
```bash
# Restart cron service
sudo systemctl restart crond

# Check cron is working
crontab -l
```
