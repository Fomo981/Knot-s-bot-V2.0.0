// ╔══════════════════════════════════════════════════╗
// ║           LORD ARCANONv1.0.0                      ║
// ║           Owner  : LORD ARCANON                   ║
// ║           Number : 237650180380               ║
// ╚══════════════════════════════════════════════════╝

import 'dotenv/config';
import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeInMemoryStore,
  jidDecode,
  proto,
  getContentType,
} from '@whiskeysockets/baileys';
import chalk from 'chalk';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import moment from 'moment-timezone';
import NodeCache from 'node-cache';
import osUtils from 'node-os-utils';
import ytSearch from 'yt-search';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Config from .env ──────────────────────────────
const {
  SESSION_ID,
  PREFIX        = '.',
  OWNER_NUMBER  = '237650180380',
  SUDO_NUMBER   = '237650180380',
  OWNER_NAME    = 'Lord Arcanon',
  BOT_NAME      = "Lr Arcanon's Bot",
  MODE          = 'public',
  ANTILINK      = 'true',
  ANTIBOT       = 'true',
  ANTIBOT_WARNINGS = '3',
  ANTI_SPAM     = 'true',
  ANTI_SPAM_LIMIT = '8',
  REJECT_CALL   = 'false',
  ANTI_DELETE   = 'true',
  AUTO_STATUS_SEEN  = 'true',
  AUTO_STATUS_REACT = 'true',
  AUTO_READ     = 'false',
  AUTO_TYPING   = 'true',
  WELCOME       = 'true',
  GOODBYE       = 'true',
} = process.env;

const OWNER_JID = `${OWNER_NUMBER}@s.whatsapp.net`;
const SUDO_JID  = `${SUDO_NUMBER}@s.whatsapp.net`;

// ── Images ────────────────────────────────────────
const IMG_LOGO    = 'https://files.catbox.moe/57dmw0.jpg';
const IMG_WELCOME = 'https://files.catbox.moe/5lf68p.png';
const IMG_GOODBYE = 'https://files.catbox.moe/93y5qz.jpg';
const PREFIX_REGEX = new RegExp(`^[${escapeRegex(PREFIX)}]`);

// ── Anti-spam map ─────────────────────────────────
const spamMap   = new Map();
const warnMap   = new Map();
const msgCache  = new NodeCache({ stdTTL: 300 });

// ── Store ─────────────────────────────────────────
const store = makeInMemoryStore({ logger: pino({ level: 'silent' }) });

// ── Utility helpers ───────────────────────────────
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isOwner(jid) {
  return jid === OWNER_JID || jid === SUDO_JID;
}

function log(color, tag, msg) {
  const colors = { green: chalk.green, red: chalk.red, cyan: chalk.cyan, yellow: chalk.yellow, blue: chalk.blue, magenta: chalk.magenta };
  const fn = colors[color] || chalk.white;
  console.log(fn(`[${tag}]`), msg);
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024, sizes = ['B','KB','MB','GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function runtime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${d}d ${h}h ${m}m ${s}s`;
}

async function getGroupAdmins(participants) {
  return participants.filter(p => p.admin).map(p => p.id);
}

// ── Banner ────────────────────────────────────────
function printBanner() {
  console.log(chalk.cyan(`
╔══════════════════════════════════════════╗
║        LORD ARCANON'S BOTv1.0        ║
║        Owner  : Lr Arcanon             ║
║        Number : ${OWNER_NUMBER}        ║
╚══════════════════════════════════════════╝
  `));
}

// ── Main bot start ────────────────────────────────
async function startBot() {
  printBanner();

  const { state, saveCreds } = await useMultiFileAuthState('./data/session');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    auth: state,
    printQRInTerminal: true,
    browser: ["Le Arcanon's Bot", 'Chrome', '1.0.0'],
    msgRetryCounterCache: new NodeCache(),
    generateHighQualityLinkPreview: true,
  });

  store.bind(sock.ev);

  // ── Connection handling ───────────────────────
  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) log('cyan', 'QR', 'Scan the QR code above with WhatsApp');
    if (connection === 'open') {
      log('green', 'CONNECTED', `${BOT_NAME} is online ✅`);
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      log('red', 'DISCONNECTED', `Code: ${code} — ${shouldReconnect ? 'Reconnecting...' : 'Logged out.'}`);
      if (shouldReconnect) setTimeout(startBot, 3000);
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // ── Call reject ───────────────────────────────
  if (REJECT_CALL === 'true') {
    sock.ev.on('call', async calls => {
      for (const call of calls) {
        if (call.status === 'offer') {
          await sock.rejectCall(call.id, call.from);
          await sock.sendMessage(call.from, { text: `❌ Sorry, ${BOT_NAME} does not accept calls.` });
        }
      }
    });
  }

  // ── Group participant updates (welcome/goodbye) ─
  sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
    if (!['add','remove'].includes(action)) return;
    const meta = await sock.groupMetadata(id).catch(() => null);
    if (!meta) return;
    const groupName = meta.subject;

    for (const jid of participants) {
      const num = jid.split('@')[0];
      if (action === 'add' && WELCOME === 'true') {
        await sock.sendMessage(id, {
          image: { url: IMG_WELCOME },
          caption: `🎉 Welcome @${num} to *${groupName}*!\n\n👑 Bot: ${BOT_NAME}\n📌 Type *${PREFIX}menu* to see all commands.\n\nEnjoy your stay! 🙏`,
          mentions: [jid],
        });
      }
      if (action === 'remove' && GOODBYE === 'true') {
        await sock.sendMessage(id, {
          image: { url: IMG_GOODBYE },
          caption: `👋 Goodbye @${num}!\nWe will miss you in *${groupName}*. 💔\n\nTake care! 🙏`,
          mentions: [jid],
        });
      }
    }
  });

  // ── Status seen ───────────────────────────────
  if (AUTO_STATUS_SEEN === 'true') {
    sock.ev.on('messages.upsert', async ({ messages }) => {
      for (const msg of messages) {
        if (msg.key.remoteJid === 'status@broadcast') {
          await sock.readMessages([msg.key]).catch(() => {});
          if (AUTO_STATUS_REACT === 'true') {
            await sock.sendMessage('status@broadcast', {
              react: { text: '❤️', key: msg.key }
            }).catch(() => {});
          }
        }
      }
    });
  }

  // ── Message handler ───────────────────────────
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const m of messages) {
      try {
        if (!m.message) continue;
        if (m.key.fromMe) continue;

        const from     = m.key.remoteJid;
        const isGroup  = from.endsWith('@g.us');
        const sender   = isGroup ? m.key.participant : from;
        const senderNum = sender?.split('@')[0];
        const isOwnerMsg = isOwner(sender);

        const msgType  = getContentType(m.message);
        const body     = m.message?.conversation
          || m.message?.[msgType]?.text
          || m.message?.[msgType]?.caption
          || '';

        // Auto read
        if (AUTO_READ === 'true') {
          await sock.readMessages([m.key]).catch(() => {});
        }

        // Auto typing indicator
        if (AUTO_TYPING === 'true' && PREFIX_REGEX.test(body)) {
          await sock.sendPresenceUpdate('composing', from).catch(() => {});
        }

        // ── Anti-spam ──────────────────────────
        if (ANTI_SPAM === 'true' && !isOwnerMsg) {
          const now = Date.now();
          const key = sender + from;
          if (!spamMap.has(key)) spamMap.set(key, []);
          const times = spamMap.get(key).filter(t => now - t < 5000);
          times.push(now);
          spamMap.set(key, times);
          if (times.length > parseInt(ANTI_SPAM_LIMIT)) {
            await sock.sendMessage(from, { text: `⚠️ @${senderNum} slow down! Anti-spam triggered.`, mentions: [sender] });
            continue;
          }
        }

        // ── Anti-link (groups only) ────────────
        if (ANTILINK === 'true' && isGroup && !isOwnerMsg) {
          const linkRegex = /https?:\/\/|wa\.me|chat\.whatsapp\.com/gi;
          if (linkRegex.test(body)) {
            try {
              const meta   = await sock.groupMetadata(from);
              const admins = await getGroupAdmins(meta.participants);
              if (!admins.includes(sender)) {
                await sock.sendMessage(from, { delete: m.key });
                await sock.sendMessage(from, {
                  text: `🚫 @${senderNum} links are not allowed here!`,
                  mentions: [sender],
                });
              }
            } catch {}
            continue;
          }
        }

        // ── Anti-delete ────────────────────────
        if (ANTI_DELETE === 'true' && msgType === 'protocolMessage') {
          const del = m.message?.protocolMessage;
          if (del?.type === 0) {
            const cached = msgCache.get(del.key.id);
            if (cached) {
              await sock.sendMessage(OWNER_JID, {
                text: `🗑️ *Deleted Message Alert*\nFrom: @${del.key.participant?.split('@')[0] || 'unknown'}\nContent: ${cached}`,
              }).catch(() => {});
            }
          }
          continue;
        }

        // Cache messages for anti-delete
        if (body) msgCache.set(m.key.id, body);

        // ── Command router ─────────────────────
        if (!PREFIX_REGEX.test(body)) continue;

        const args    = body.slice(1).trim().split(/\s+/);
        const cmd     = args.shift().toLowerCase();
        const text    = args.join(' ');
        const quoted  = m.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;

        // MODE check
        if (MODE === 'private' && !isOwnerMsg) continue;
        if (MODE === 'inbox'   && isGroup)     continue;
        if (MODE === 'group'   && !isGroup)    continue;

        // Reply helper
        const reply = (txt) => sock.sendMessage(from, { text: txt }, { quoted: m });

        log('cyan', 'CMD', `${senderNum} → ${PREFIX}${cmd} ${text}`);

        // ══════════════════════════════════════
        //  C O M M A N D S
        // ══════════════════════════════════════

        switch (cmd) {

          // ── HELP / MENU ──────────────────────
          case 'menu':
          case 'help': {
            const now = moment().tz('Africa/Douala');
            const menuText = `
*⏰ ${now.format('HH:mm:ss')} | 📅 ${now.format('dddd, D MMMM YYYY')}*

*📋 GENERAL*
${PREFIX}menu / help — Show this menu
${PREFIX}ping — Bot speed test
${PREFIX}info — Bot information
${PREFIX}runtime — Bot uptime
${PREFIX}system — Server stats

*🎨 FUN & TOOLS*
${PREFIX}say <text> — Echo a message
${PREFIX}tr <lang> <text> — Translate text
${PREFIX}time — Current time
${PREFIX}date — Current date
${PREFIX}calc <expr> — Calculator
${PREFIX}weather <city> — Weather info
${PREFIX}define <word> — Word definition
${PREFIX}joke — Random joke
${PREFIX}quote — Inspirational quote
${PREFIX}fact — Random fact
${PREFIX}flip — Flip a coin
${PREFIX}roll <N> — Roll dice
${PREFIX}8ball <q> — Magic 8-ball
${PREFIX}rate <thing> — Rate anything

*📥 YOUTUBE*
${PREFIX}yts <query> — Search YouTube
${PREFIX}play <query> — YouTube info

*👤 USER INFO*
${PREFIX}whoami — Your info
${PREFIX}pp @user — Profile picture
${PREFIX}vv — Reveal view-once media

*👥 GROUP (admins only)*
${PREFIX}kick @user | ${PREFIX}add <num>
${PREFIX}promote | ${PREFIX}demote @user
${PREFIX}mute | ${PREFIX}unmute
${PREFIX}lock | ${PREFIX}unlock
${PREFIX}invite | ${PREFIX}revoke
${PREFIX}tagall | ${PREFIX}hidetag <msg>
${PREFIX}groupinfo | ${PREFIX}listadmins
${PREFIX}listmembers

*🛡️ PROTECTION*
${PREFIX}warn | ${PREFIX}resetwarn | ${PREFIX}warnlist
${PREFIX}antilinkson | ${PREFIX}antilinksoff

*👑 OWNER ONLY*
${PREFIX}broadcast | ${PREFIX}setbio | ${PREFIX}setname
${PREFIX}mode | ${PREFIX}clearcache | ${PREFIX}restart

💡 Powered by *Lord Arcanon* 🇨🇲
`;
            await sock.sendMessage(from, {
              image: { url: IMG_LOGO },
              caption: menuText,
            }, { quoted: m });
            break;
          }

          // ── PING ─────────────────────────────
          case 'ping': {
            const start = Date.now();
            const sent  = await reply('🏓 Pinging...');
            const ms    = Date.now() - start;
            await sock.sendMessage(from, { text: `🏓 *Pong!* \n⚡ Speed: *${ms}ms*` }, { quoted: m });
            break;
          }

          // ── INFO ─────────────────────────────
          case 'info': {
            await reply(
`╔══════════════════════════╗
║    *BOT INFORMATION*      ║
╚══════════════════════════╝
🤖 Name    : ${BOT_NAME}
👑 Owner   : ${OWNER_NAME}
📱 Number  : ${OWNER_NUMBER}
🌍 Country : Cameroon 🇨🇲
🔧 Prefix  : ${PREFIX}
⚙️ Mode    : ${MODE}
🛡️ AntiLink: ${ANTILINK === 'true' ? 'ON ✅' : 'OFF ❌'}
🔇 AntiSpam: ${ANTI_SPAM === 'true' ? 'ON ✅' : 'OFF ❌'}

💡 Powered by Le Arcanon
`);
            break;
          }

          // ── RUNTIME ──────────────────────────
          case 'runtime':
          case 'uptime': {
            const upSec = process.uptime();
            await reply(`⏱️ *Bot Uptime*\n${runtime(upSec)}`);
            break;
          }

          // ── SYSTEM STATS ─────────────────────
          case 'system': {
            const cpu  = await osUtils.cpu.usage();
            const mem  = await osUtils.mem.info();
            const disk = await osUtils.drive.info('/').catch(() => ({ usedPercentage: 'N/A' }));
            await reply(
`🖥️ *System Stats*
━━━━━━━━━━━━━━━━
💻 CPU Usage : ${cpu.toFixed(1)}%
🧠 RAM Used  : ${mem.usedMemMb}MB / ${mem.totalMemMb}MB
💾 Disk Used : ${disk.usedPercentage}%
⏱️ Uptime    : ${runtime(process.uptime())}
🟢 Node.js   : ${process.version}
`);
            break;
          }

          // ── SAY ───────────────────────────────
          case 'say':
          case 'echo': {
            if (!text) return reply(`Usage: ${PREFIX}say <message>`);
            await sock.sendMessage(from, { text });
            break;
          }

          // ── TIME ──────────────────────────────
          case 'time': {
            const tz = text || 'Africa/Douala';
            const t  = moment().tz(tz);
            await reply(`🕐 *Time in ${tz}*\n${t.format('HH:mm:ss\ndddd, D MMMM YYYY')}`);
            break;
          }

          // ── DATE ──────────────────────────────
          case 'date': {
            const d = moment().tz('Africa/Douala');
            await reply(`📅 *Date (Cameroon)*\n${d.format('dddd, D MMMM YYYY')}`);
            break;
          }

          // ── CALCULATOR ────────────────────────
          case 'calc':
          case 'math': {
            if (!text) return reply(`Usage: ${PREFIX}calc 2+2`);
            try {
              const safe = text.replace(/[^0-9+\-*/.()% ]/g, '');
              // eslint-disable-next-line no-eval
              const result = Function(`"use strict"; return (${safe})`)();
              await reply(`🧮 *Calculator*\n${safe} = *${result}*`);
            } catch {
              await reply('❌ Invalid expression.');
            }
            break;
          }

          // ── TRANSLATE ────────────────────────
          case 'tr':
          case 'translate': {
            const parts = text.split(' ');
            const lang  = parts[0] || 'en';
            const toTr  = parts.slice(1).join(' ');
            if (!toTr) return reply(`Usage: ${PREFIX}tr <lang> <text>\nExamples: fr, en, es, de, ar, zh`);
            try {
              const res = await axios.get(
                `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${lang}&dt=t&q=${encodeURIComponent(toTr)}`
              );
              const translated = res.data[0].map(x => x[0]).join('');
              await reply(`🌍 *Translation (→ ${lang.toUpperCase()})*\n${translated}`);
            } catch {
              await reply('❌ Translation failed. Check the language code.');
            }
            break;
          }

          // ── WEATHER ──────────────────────────
          case 'weather': {
            if (!text) return reply(`Usage: ${PREFIX}weather <city>\nExample: ${PREFIX}weather Douala`);
            try {
              const res = await axios.get(
                `https://wttr.in/${encodeURIComponent(text)}?format=4`
              );
              await reply(`🌤️ *Weather*\n${res.data}`);
            } catch {
              await reply('❌ Could not get weather. Try a different city name.');
            }
            break;
          }

          // ── DEFINE ───────────────────────────
          case 'define':
          case 'dict': {
            if (!text) return reply(`Usage: ${PREFIX}define <word>`);
            try {
              const res  = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(text)}`);
              const data = res.data[0];
              const def  = data.meanings[0]?.definitions[0];
              await reply(
`📖 *${data.word}* (${data.meanings[0]?.partOfSpeech})
━━━━━━━━━━━━━━━━
📝 ${def?.definition}
${def?.example ? `\n💬 Example: _${def.example}_` : ''}
${data.phonetics?.[0]?.text ? `\n🔊 ${data.phonetics[0].text}` : ''}`
              );
            } catch {
              await reply(`❌ Definition not found for "*${text}*".`);
            }
            break;
          }

          // ── JOKE ─────────────────────────────
          case 'joke': {
            try {
              const res = await axios.get('https://v2.jokeapi.dev/joke/Any?blacklistFlags=nsfw,racist,sexist');
              const j   = res.data;
              const txt = j.type === 'single' ? j.joke : `${j.setup}\n\n😂 ${j.delivery}`;
              await reply(`😂 *Joke*\n━━━━━━━━\n${txt}`);
            } catch {
              const jokes = [
                'Why do programmers prefer dark mode? Because light attracts bugs! 🐛',
                'Why did the developer quit? They didn\'t get arrays! 😂',
                'I told my computer I needed a break. Now it won\'t stop sending me Kit Kat ads.',
              ];
              await reply(`😂 *Joke*\n━━━━━━\n${jokes[Math.floor(Math.random() * jokes.length)]}`);
            }
            break;
          }

          // ── QUOTE ────────────────────────────
          case 'quote': {
            try {
              const res = await axios.get('https://zenquotes.io/api/random');
              const q   = res.data[0];
              await reply(`💭 *Quote*\n━━━━━━━━\n_"${q.q}"_\n\n— *${q.a}*`);
            } catch {
              const quotes = [
                '"Code is like humor. When you have to explain it, it\'s bad." — Cory House',
                '"First, solve the problem. Then, write the code." — John Johnson',
                '"The best error message is the one that never shows up." — Thomas Fuchs',
              ];
              await reply(`💭 *Quote*\n━━━━━━\n${quotes[Math.floor(Math.random() * quotes.length)]}`);
            }
            break;
          }

          // ── FACT ─────────────────────────────
          case 'fact': {
            try {
              const res = await axios.get('https://uselessfacts.jsph.pl/random.json?language=en');
              await reply(`🧠 *Random Fact*\n━━━━━━━━━━━\n${res.data.text}`);
            } catch {
              const facts = [
                'Honey never spoils. Archaeologists have found 3000-year-old honey in Egyptian tombs! 🍯',
                'A group of flamingos is called a "flamboyance". 🦩',
                'Octopuses have three hearts. 🐙',
              ];
              await reply(`🧠 *Random Fact*\n━━━━━━━━━\n${facts[Math.floor(Math.random() * facts.length)]}`);
            }
            break;
          }

          // ── FLIP COIN ────────────────────────
          case 'flip':
          case 'coin': {
            const result = Math.random() < 0.5 ? '🪙 *HEADS*' : '🪙 *TAILS*';
            await reply(`Flipping a coin...\n\nResult: ${result}`);
            break;
          }

          // ── DICE ─────────────────────────────
          case 'roll':
          case 'dice': {
            const max = parseInt(text) || 6;
            const val = Math.floor(Math.random() * max) + 1;
            await reply(`🎲 *Dice Roll* (1–${max})\nResult: *${val}*`);
            break;
          }

          // ── MAGIC 8 BALL ─────────────────────
          case '8ball': {
            if (!text) return reply(`Usage: ${PREFIX}8ball <question>`);
            const answers = [
              'It is certain ✅','It is decidedly so ✅','Without a doubt ✅',
              'Yes, definitely ✅','You may rely on it ✅','As I see it, yes ✅',
              'Most likely ✅','Outlook good ✅','Yes ✅','Signs point to yes ✅',
              'Reply hazy, try again 🔮','Ask again later 🔮','Better not tell now 🔮',
              'Cannot predict now 🔮','Concentrate and ask again 🔮',
              "Don't count on it ❌",'My reply is no ❌','My sources say no ❌',
              'Outlook not so good ❌','Very doubtful ❌',
            ];
            await reply(`🎱 *Magic 8-Ball*\n❓ ${text}\n\n${answers[Math.floor(Math.random() * answers.length)]}`);
            break;
          }

          // ── RATE ─────────────────────────────
          case 'rate': {
            if (!text) return reply(`Usage: ${PREFIX}rate <anything>`);
            const score = Math.floor(Math.random() * 101);
            const bar   = '█'.repeat(Math.floor(score / 10)) + '░'.repeat(10 - Math.floor(score / 10));
            await reply(`⭐ *Rating: ${text}*\n[${bar}] ${score}/100`);
            break;
          }

          // ── EMOJIMIX ─────────────────────────
          case 'emojimix': {
            const emojis = text.split(' ');
            if (emojis.length < 2) return reply(`Usage: ${PREFIX}emojimix 😀 🔥`);
            await reply(`✨ ${emojis[0]} + ${emojis[1]} = ${emojis[0]}${emojis[1]}`);
            break;
          }

          // ── WHOAMI ───────────────────────────
          case 'whoami': {
            await reply(
`👤 *Your Info*
━━━━━━━━━━━━
📱 Number : +${senderNum}
🔗 JID    : ${sender}
👑 Owner  : ${isOwnerMsg ? 'Yes ✅' : 'No ❌'}
📍 Chat   : ${isGroup ? 'Group' : 'Private'}`
            );
            break;
          }

          // ── PROFILE PIC ──────────────────────
          case 'pp': {
            const mentioned = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || sender;
            try {
              const url = await sock.profilePictureUrl(mentioned, 'image');
              await sock.sendMessage(from, {
                image: { url },
                caption: `🖼️ Profile picture of @${mentioned.split('@')[0]}`,
                mentions: [mentioned],
              }, { quoted: m });
            } catch {
              await reply('❌ Could not get profile picture (private or not set).');
            }
            break;
          }

          // ── VIEW ONCE (.vv) ──────────────────
          case 'vv':
          case 'viewonce': {
            const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quoted) return reply(`❌ Reply to a view-once image or video with *${PREFIX}vv* to reveal it.`);

            // Check all possible view-once message types
            const voImg   = quoted?.viewOnceMessage?.message?.imageMessage
                         || quoted?.viewOnceMessageV2?.message?.imageMessage
                         || quoted?.viewOnceMessageV2Extension?.message?.imageMessage;
            const voVid   = quoted?.viewOnceMessage?.message?.videoMessage
                         || quoted?.viewOnceMessageV2?.message?.videoMessage
                         || quoted?.viewOnceMessageV2Extension?.message?.videoMessage;

            if (!voImg && !voVid) {
              return reply('❌ The replied message is not a view-once image or video.');
            }

            try {
              // Reconstruct the media message without view-once flag
              const voMsg = quoted?.viewOnceMessage?.message
                         || quoted?.viewOnceMessageV2?.message
                         || quoted?.viewOnceMessageV2Extension?.message;

              // Download the media buffer
              const stream = await sock.downloadMediaMessage(
                { message: voMsg, key: m.message.extendedTextMessage.contextInfo.stanzaId },
                'buffer',
                {}
              );

              if (voImg) {
                await sock.sendMessage(from, {
                  image: stream,
                  caption: `👁️ *View-Once Image Revealed*\n📌 Saved by ${BOT_NAME}`,
                }, { quoted: m });
              } else {
                await sock.sendMessage(from, {
                  video: stream,
                  caption: `👁️ *View-Once Video Revealed*\n📌 Saved by ${BOT_NAME}`,
                }, { quoted: m });
              }
            } catch (e) {
              await reply(`❌ Could not reveal media. Error: ${e.message}`);
            }
            break;
          }

          // ── YOUTUBE SEARCH ───────────────────
          case 'yts':
          case 'ytsearch': {
            if (!text) return reply(`Usage: ${PREFIX}yts <query>`);
            try {
              const results = await ytSearch(text);
              const vids    = results.videos.slice(0, 5);
              if (!vids.length) return reply('❌ No results found.');
              let msg = `🎬 *YouTube Results for:* _${text}_\n━━━━━━━━━━━━━━━━━\n`;
              vids.forEach((v, i) => {
                msg += `\n*${i + 1}.* ${v.title}\n⏱️ ${v.timestamp} | 👁️ ${v.views?.toLocaleString() || '?'} views\n🔗 ${v.url}\n`;
              });
              await reply(msg);
            } catch {
              await reply('❌ YouTube search failed.');
            }
            break;
          }

          // ── YOUTUBE PLAY ─────────────────────
          case 'play': {
            if (!text) return reply(`Usage: ${PREFIX}play <song name>`);
            try {
              const results = await ytSearch(text);
              const v = results.videos[0];
              if (!v) return reply('❌ No results found.');
              await reply(
`🎵 *Now Playing*
━━━━━━━━━━━━━━
🎬 ${v.title}
⏱️ Duration : ${v.timestamp}
👁️ Views    : ${v.views?.toLocaleString() || '?'}
📅 Uploaded : ${v.ago}
🔗 ${v.url}

_Use a YouTube downloader site to get the audio file._`
              );
            } catch {
              await reply('❌ Search failed.');
            }
            break;
          }

          // ═══════════════════════════════════
          //  GROUP COMMANDS (admin only)
          // ═══════════════════════════════════

          case 'kick': {
            if (!isGroup) return reply('❌ Group only command.');
            const meta   = await sock.groupMetadata(from);
            const admins = await getGroupAdmins(meta.participants);
            if (!admins.includes(sender) && !isOwnerMsg) return reply('❌ Admins only.');
            const target = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!target) return reply(`Usage: ${PREFIX}kick @user`);
            await sock.groupParticipantsUpdate(from, [target], 'remove');
            await reply(`✅ @${target.split('@')[0]} has been removed.`);
            break;
          }

          case 'add': {
            if (!isGroup) return reply('❌ Group only command.');
            const meta   = await sock.groupMetadata(from);
            const admins = await getGroupAdmins(meta.participants);
            if (!admins.includes(sender) && !isOwnerMsg) return reply('❌ Admins only.');
            if (!text) return reply(`Usage: ${PREFIX}add <number> (e.g. 237652894978)`);
            const num = text.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
            await sock.groupParticipantsUpdate(from, [num], 'add');
            await reply(`✅ ${text} has been added.`);
            break;
          }

          case 'promote': {
            if (!isGroup) return reply('❌ Group only command.');
            const meta   = await sock.groupMetadata(from);
            const admins = await getGroupAdmins(meta.participants);
            if (!admins.includes(sender) && !isOwnerMsg) return reply('❌ Admins only.');
            const target = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!target) return reply(`Usage: ${PREFIX}promote @user`);
            await sock.groupParticipantsUpdate(from, [target], 'promote');
            await reply(`⬆️ @${target.split('@')[0]} promoted to admin.`);
            break;
          }

          case 'demote': {
            if (!isGroup) return reply('❌ Group only command.');
            const meta   = await sock.groupMetadata(from);
            const admins = await getGroupAdmins(meta.participants);
            if (!admins.includes(sender) && !isOwnerMsg) return reply('❌ Admins only.');
            const target = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!target) return reply(`Usage: ${PREFIX}demote @user`);
            await sock.groupParticipantsUpdate(from, [target], 'demote');
            await reply(`⬇️ @${target.split('@')[0]} demoted from admin.`);
            break;
          }

          case 'mute': {
            if (!isGroup) return reply('❌ Group only command.');
            const meta   = await sock.groupMetadata(from);
            const admins = await getGroupAdmins(meta.participants);
            if (!admins.includes(sender) && !isOwnerMsg) return reply('❌ Admins only.');
            await sock.groupSettingUpdate(from, 'announcement');
            await reply('🔇 Group muted. Only admins can send messages.');
            break;
          }

          case 'unmute': {
            if (!isGroup) return reply('❌ Group only command.');
            const meta   = await sock.groupMetadata(from);
            const admins = await getGroupAdmins(meta.participants);
            if (!admins.includes(sender) && !isOwnerMsg) return reply('❌ Admins only.');
            await sock.groupSettingUpdate(from, 'not_announcement');
            await reply('🔊 Group unmuted. Everyone can send messages.');
            break;
          }

          case 'lock': {
            if (!isGroup) return reply('❌ Group only command.');
            const meta   = await sock.groupMetadata(from);
            const admins = await getGroupAdmins(meta.participants);
            if (!admins.includes(sender) && !isOwnerMsg) return reply('❌ Admins only.');
            await sock.groupSettingUpdate(from, 'locked');
            await reply('🔒 Group info locked. Only admins can edit.');
            break;
          }

          case 'unlock': {
            if (!isGroup) return reply('❌ Group only command.');
            const meta   = await sock.groupMetadata(from);
            const admins = await getGroupAdmins(meta.participants);
            if (!admins.includes(sender) && !isOwnerMsg) return reply('❌ Admins only.');
            await sock.groupSettingUpdate(from, 'unlocked');
            await reply('🔓 Group info unlocked. Everyone can edit.');
            break;
          }

          case 'invite': {
            if (!isGroup) return reply('❌ Group only command.');
            const meta   = await sock.groupMetadata(from);
            const admins = await getGroupAdmins(meta.participants);
            if (!admins.includes(sender) && !isOwnerMsg) return reply('❌ Admins only.');
            const code = await sock.groupInviteCode(from);
            await reply(`🔗 *Group Invite Link*\nhttps://chat.whatsapp.com/${code}`);
            break;
          }

          case 'revoke': {
            if (!isGroup) return reply('❌ Group only command.');
            const meta   = await sock.groupMetadata(from);
            const admins = await getGroupAdmins(meta.participants);
            if (!admins.includes(sender) && !isOwnerMsg) return reply('❌ Admins only.');
            await sock.groupRevokeInvite(from);
            await reply('✅ Invite link has been revoked and reset.');
            break;
          }

          case 'groupinfo': {
            if (!isGroup) return reply('❌ Group only command.');
            const meta = await sock.groupMetadata(from);
            const admins = await getGroupAdmins(meta.participants);
            await reply(
`📊 *Group Info*
━━━━━━━━━━━━━━━
📛 Name    : ${meta.subject}
👥 Members : ${meta.participants.length}
👑 Admins  : ${admins.length}
📅 Created : ${moment(meta.creation * 1000).format('D MMM YYYY')}
📝 Desc    : ${meta.desc || 'No description'}
🔗 ID      : ${from}`
            );
            break;
          }

          case 'listadmins': {
            if (!isGroup) return reply('❌ Group only command.');
            const meta   = await sock.groupMetadata(from);
            const admins = await getGroupAdmins(meta.participants);
            let msg = `👑 *Group Admins (${admins.length})*\n━━━━━━━━━━━━━\n`;
            admins.forEach((a, i) => { msg += `${i + 1}. @${a.split('@')[0]}\n`; });
            await sock.sendMessage(from, { text: msg, mentions: admins }, { quoted: m });
            break;
          }

          case 'listmembers': {
            if (!isGroup) return reply('❌ Group only command.');
            const meta    = await sock.groupMetadata(from);
            const members = meta.participants.map(p => p.id);
            let msg = `👥 *Members (${members.length})*\n━━━━━━━━━━━━\n`;
            members.forEach((p, i) => { msg += `${i + 1}. @${p.split('@')[0]}\n`; });
            await sock.sendMessage(from, { text: msg, mentions: members }, { quoted: m });
            break;
          }

          case 'tagall': {
            if (!isGroup) return reply('❌ Group only command.');
            const meta    = await sock.groupMetadata(from);
            const admins  = await getGroupAdmins(meta.participants);
            if (!admins.includes(sender) && !isOwnerMsg) return reply('❌ Admins only.');
            const members = meta.participants.map(p => p.id);
            const mentions = members.map(p => `@${p.split('@')[0]}`).join(' ');
            await sock.sendMessage(from, {
              text: `📢 ${text || 'Attention everyone!'}\n\n${mentions}`,
              mentions: members,
            }, { quoted: m });
            break;
          }

          case 'hidetag': {
            if (!isGroup) return reply('❌ Group only command.');
            const meta    = await sock.groupMetadata(from);
            const admins  = await getGroupAdmins(meta.participants);
            if (!admins.includes(sender) && !isOwnerMsg) return reply('❌ Admins only.');
            const members = meta.participants.map(p => p.id);
            await sock.sendMessage(from, {
              text: text || '📢 Important announcement!',
              mentions: members,
            }, { quoted: m });
            break;
          }

          // ═══════════════════════════════════
          //  PROTECTION COMMANDS
          // ═══════════════════════════════════

          case 'antilinkson': {
            if (!isGroup) return reply('❌ Group only command.');
            const meta   = await sock.groupMetadata(from);
            const admins = await getGroupAdmins(meta.participants);
            if (!admins.includes(sender) && !isOwnerMsg) return reply('❌ Admins only.');
            process.env.ANTILINK = 'true';
            await reply('🛡️ AntiLink is now *ENABLED*.');
            break;
          }

          case 'antilinksoff': {
            if (!isGroup) return reply('❌ Group only command.');
            const meta   = await sock.groupMetadata(from);
            const admins = await getGroupAdmins(meta.participants);
            if (!admins.includes(sender) && !isOwnerMsg) return reply('❌ Admins only.');
            process.env.ANTILINK = 'false';
            await reply('🔓 AntiLink is now *DISABLED*.');
            break;
          }

          case 'warn': {
            if (!isGroup) return reply('❌ Group only command.');
            const meta   = await sock.groupMetadata(from);
            const admins = await getGroupAdmins(meta.participants);
            if (!admins.includes(sender) && !isOwnerMsg) return reply('❌ Admins only.');
            const target = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!target) return reply(`Usage: ${PREFIX}warn @user`);
            const key    = target + from;
            const warns  = (warnMap.get(key) || 0) + 1;
            warnMap.set(key, warns);
            const limit  = parseInt(ANTIBOT_WARNINGS);
            if (warns >= limit) {
              await sock.groupParticipantsUpdate(from, [target], 'remove');
              warnMap.delete(key);
              await reply(`🚫 @${target.split('@')[0]} reached ${limit} warnings and was *removed*.`);
            } else {
              await sock.sendMessage(from, {
                text: `⚠️ Warning ${warns}/${limit} for @${target.split('@')[0]}!\n${text || 'Please follow group rules.'}`,
                mentions: [target],
              }, { quoted: m });
            }
            break;
          }

          case 'resetwarn': {
            if (!isGroup) return reply('❌ Group only command.');
            const target = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!target) return reply(`Usage: ${PREFIX}resetwarn @user`);
            warnMap.delete(target + from);
            await reply(`✅ Warnings reset for @${target.split('@')[0]}.`);
            break;
          }

          case 'warnlist': {
            if (!isGroup) return reply('❌ Group only command.');
            let msg = `⚠️ *Warned Users*\n━━━━━━━━━━━━\n`;
            let count = 0;
            for (const [key, val] of warnMap.entries()) {
              if (key.endsWith(from.split('@')[0])) {
                msg += `@${key.split('@')[0]} — ${val} warning(s)\n`;
                count++;
              }
            }
            if (!count) msg += '_No warned users in this group._';
            await reply(msg);
            break;
          }

          // ═══════════════════════════════════
          //  OWNER COMMANDS
          // ═══════════════════════════════════

          case 'broadcast': {
            if (!isOwnerMsg) return reply('❌ Owner only command.');
            if (!text) return reply(`Usage: ${PREFIX}broadcast <message>`);
            const chats = store.chats.all();
            let count   = 0;
            for (const chat of chats) {
              try {
                await sock.sendMessage(chat.id, {
                  text: `📢 *Broadcast from ${BOT_NAME}*\n\n${text}`,
                });
                count++;
              } catch {}
            }
            await reply(`✅ Broadcast sent to ${count} chats.`);
            break;
          }

          case 'setbio': {
            if (!isOwnerMsg) return reply('❌ Owner only command.');
            if (!text) return reply(`Usage: ${PREFIX}setbio <bio>`);
            await sock.updateProfileStatus(text);
            await reply(`✅ Bio updated to: _${text}_`);
            break;
          }

          case 'setname': {
            if (!isOwnerMsg) return reply('❌ Owner only command.');
            if (!text) return reply(`Usage: ${PREFIX}setname <name>`);
            await sock.updateProfileName(text);
            await reply(`✅ Name updated to: *${text}*`);
            break;
          }

          case 'mode': {
            if (!isOwnerMsg) return reply('❌ Owner only command.');
            const modes = ['public','private','inbox','group'];
            if (!modes.includes(text)) return reply(`Usage: ${PREFIX}mode <public|private|inbox|group>`);
            process.env.MODE = text;
            await reply(`✅ Bot mode set to *${text}*.`);
            break;
          }

          case 'clearcache': {
            if (!isOwnerMsg) return reply('❌ Owner only command.');
            msgCache.flushAll();
            spamMap.clear();
            await reply('✅ Cache cleared.');
            break;
          }

          case 'eval': {
            if (!isOwnerMsg) return reply('❌ Owner only command.');
            if (!text) return reply(`Usage: ${PREFIX}eval <js code>`);
            try {
              let result = eval(text);
              if (result instanceof Promise) result = await result;
              await reply(`✅ Result:\n${JSON.stringify(result, null, 2)}`);
            } catch (e) {
              await reply(`❌ Error:\n${e.message}`);
            }
            break;
          }

          case 'restart': {
            if (!isOwnerMsg) return reply('❌ Owner only command.');
            await reply('🔄 Restarting bot...');
            process.exit(0);
            break;
          }

          // ── Unknown command ──────────────────
          default: {
            await reply(`❓ Unknown command: *${PREFIX}${cmd}*\nType *${PREFIX}menu* to see all commands.`);
            break;
          }
        }

      } catch (err) {
        log('red', 'ERROR', err.message);
      }
    }
  });
}

startBot().catch(err => {
  log('red', 'FATAL', err.message);
  process.exit(1);
});
