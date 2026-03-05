// index.js
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const express = require('express');

// ===== ENV DEĞİŞKENLERİ =====
const GUILD_ID = process.env.GUILD_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const PORT = process.env.PORT || 3000;

// ===== CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Channel, Partials.GuildMember]
});

// ===== WEB SERVER =====
const app = express();
app.get('/', (req, res) => res.send('Bot çalışıyor 😎'));
app.listen(PORT, () => console.log(`Web server ${PORT} portunda açık`));

// ===== BOT READY =====
client.once('ready', () => {
  console.log(`Bot açıldı: ${client.user.tag}`);
  client.user.setStatus('online');

  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return console.log('Sunucu bulunamadı!');
  
  client.logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
});

// ===== GUARD =====
let backupChannels = {};
let backupRoles = {};
let channelRestoreCount = {};
let roleRestoreCount = {};
const LIMIT = 5;
const WINDOW = 5 * 60 * 1000;

// Kanalları ve rolleri yedekle
client.on('ready', () => {
  const guild = client.guilds.cache.get(GUILD_ID);

  guild.channels.cache.forEach(ch => {
    backupChannels[ch.id] = {
      name: ch.name,
      type: ch.type,
      parentId: ch.parentId,
      permissions: ch.permissionOverwrites.cache.map(p => ({
        id: p.id,
        allow: p.allow.bitfield,
        deny: p.deny.bitfield
      }))
    };
  });

  guild.roles.cache.forEach(r => {
    backupRoles[r.id] = {
      name: r.name,
      color: r.color,
      permissions: r.permissions.bitfield,
      hoist: r.hoist,
      mentionable: r.mentionable
    };
  });
});

// Kanal silme
client.on('channelDelete', async channel => {
  const guild = channel.guild;
  const userId = 'unknown';
  channelRestoreCount[userId] = (channelRestoreCount[userId] || 0) + 1;
  if (channelRestoreCount[userId] > LIMIT) return;

  setTimeout(() => channelRestoreCount[userId]--, WINDOW);

  const data = backupChannels[channel.id];
  if (data) {
    guild.channels.create({
      name: data.name,
      type: data.type,
      parent: data.parentId
    });
    if (client.logChannel) client.logChannel.send(`🟢 Kanal geri oluşturuldu: ${data.name}`);
  }
});

// Rol silme
client.on('roleDelete', async role => {
  const guild = role.guild;
  const userId = 'unknown';
  roleRestoreCount[userId] = (roleRestoreCount[userId] || 0) + 1;
  if (roleRestoreCount[userId] > LIMIT) return;

  setTimeout(() => roleRestoreCount[userId]--, WINDOW);

  const data = backupRoles[role.id];
  if (data) {
    guild.roles.create({
      name: data.name,
      color: data.color,
      permissions: data.permissions,
      hoist: data.hoist,
      mentionable: data.mentionable
    });
    if (client.logChannel) client.logChannel.send(`🟢 Rol geri oluşturuldu: ${data.name}`);
  }
});

// ===== BOT LOGIN =====
client.login(DISCORD_TOKEN);
