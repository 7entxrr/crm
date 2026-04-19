# Environment Variables for Clear Lands CRM

Add these variables to your Vercel project environment settings:
https://vercel.com/raj-tiwaris-projects-03e52698/crm-d5to/settings/environment-variables

## Required Variables

### OTP_SECRET
- **Description**: Secret key used for OTP hashing
- **Example**: Generate a random 32+ character string
- **How to generate**: `openssl rand -base64 32` or use any random string generator

### SMTP Configuration
- **SMTP_HOST**: Your email server host (e.g., smtp.gmail.com, smtp.office365.com)
- **SMTP_PORT**: Email server port (usually 587 for TLS, 465 for SSL)
- **SMTP_SECURE**: true or false (use true for SSL, false for TLS)
- **SMTP_USER**: Your email username (usually your full email address)
- **SMTP_PASS**: Your email password or app-specific password
- **SMTP_FROM**: The email address to send from (usually same as SMTP_USER)

## Actual Values

```
OTP_SECRET=z9cwDRb+bEVUmyn2StFEt8K28jdTMZctdi0XJBFZedE=
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=7entxrrr@gmail.com
SMTP_PASS=sbji jgek fdtw ckwf
SMTP_FROM=7entxrrr@gmail.com
```

## How to Add to Vercel

### Option 1: Via CLI
```bash
vercel env add OTP_SECRET production
# Enter your value when prompted

vercel env add SMTP_HOST production
# Enter your value when prompted

# Repeat for all variables...
```

### Option 2: Via Dashboard
1. Go to: https://vercel.com/raj-tiwaris-projects-03e52698/crm-d5to/settings/environment-variables
2. Click "Add New"
3. Add each variable with its value
4. Select "Production" environment
5. Click "Save"
6. After adding all, redeploy: `vercel --prod`

## After Adding Variables

Once all environment variables are configured, the `/api/auth/send-otp` endpoint will work correctly for sending OTP emails during 2FA authentication.
