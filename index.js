const { Client, GatewayIntentBits, Partials } = require('discord.js');
const express = require('express');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,     // Portalda aktif et
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildPresences    // Portalda aktif et
  ],
  partials: [Partials.Channel, Partials.GuildMember]
});

// ===== ENV DEĞİŞKENLERİ =====
const GUILD_ID = process.env.GUILD_ID;
const VOICE_CHANNEL_ID = process.env.VOICE_CHANNEL_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
const PORT = process.env.PORT || 3000;

// ===== WEB SERVER =====
const app = express();
app.get('/', (req, res) => res.send('Bot çalışıyor 😎'));
app.listen(PORT, () => console.log(`Web server ${PORT} portunda açık`));

// ===== BOT BAŞLANGIÇ =====
client.once('ready', async () => {
  console.log(`Bot açıldı: ${client.user.tag}`);
  client.user.setStatus('online'); // Hep aktif görünmesi için

  const guild = client.guilds.cache.get(GUILD_ID);
  const voiceChannel = guild?.channels.cache.get(VOICE_CHANNEL_ID);
  if (voiceChannel) {
    try {
      await voiceChannel.join();
      console.log('Bot ses kanalına girdi ve AFK kaldı');
    } catch (err) {
      console.log('Ses kanalına girerken hata:', err);
    }
  } else console.log('Ses kanalı bulunamadı!');
});

// ===== BOTU BAŞLAT =====
client.login(process.env.DISCORD_TOKEN);
