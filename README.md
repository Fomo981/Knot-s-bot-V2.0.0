# KNOT'S BOT v1.0
### By King Knot S | The Knot's Empire 🇨🇲

A clean, safe, fully-featured WhatsApp bot built on Baileys.
No obfuscated code. No external downloads. 100% yours.

---

## ⚙️ Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure your .env
Edit `.env` and fill in your `SESSION_ID`.
Your number and name are already set.

### 3. Get your Session ID
Run the bot once with `npm run dev`, scan the QR code with WhatsApp.
Your session will be saved in `data/session/`.

### 4. Start the bot
```bash
# Development
npm run dev

# Production (pm2)
npm run pm2
```

---

## 🚀 Deploy Options

### Replit
Import the project, run `npm install` then `npm run dev`.

### Railway / Render / Koyeb
Push to GitHub, connect repo, set env vars from `.env`.

---

## 📋 Commands (50+)

| Category | Commands |
|----------|----------|
| General | .menu .ping .info .runtime .system |
| Fun | .joke .quote .fact .flip .roll .8ball .rate |
| Tools | .calc .tr .weather .define .say .time .date |
| YouTube | .yts .play |
| User | .whoami .pp |
| Group | .kick .add .promote .demote .mute .unmute .lock .unlock .invite .revoke .groupinfo .listadmins .listmembers .tagall .hidetag |
| Protection | .warn .resetwarn .warnlist .antilinkson .antilinksoff |
| Owner | .broadcast .setbio .setname .mode .clearcache .eval .restart |

---

## 🛡️ Security Features
- ✅ Anti-Link (auto-delete links in groups)
- ✅ Anti-Spam (rate limiter per user)
- ✅ Anti-Delete (recover deleted messages)
- ✅ Warning system (auto-kick on limit)
- ✅ Owner-only commands
- ✅ Call rejection (optional)
- ✅ No external code downloads

---

Made with ❤️ by **King Knot S** — The Knot's Empire
