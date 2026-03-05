const { Client, GatewayIntentBits, Partials } = require('discord.js');
const express = require('express');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildBans
  ],
  partials: [Partials.Channel]
});

// Env değişkenleri
const GUILD_ID = process.env.GUILD_ID;
const VOICE_CHANNEL_ID = process.env.VOICE_CHANNEL_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

const PORT = process.env.PORT || 3000;

// Express web server
const app = express();
app.get('/', (req,res) => res.send('Bot çalışıyor 😎'));
app.listen(PORT, () => console.log(`Web server ${PORT} portunda açık`));

let backupChannels = {};
let backupRoles = {};
let channelRestoreCount = {};
let roleRestoreCount = {};
const LIMIT = 5;
const WINDOW = 300000; // 5 dakika

client.once('ready', async () => {
  console.log(`Bot açıldı: ${client.user.tag}`);
  client.user.setStatus('idle');

  const guild = client.guilds.cache.get(GUILD_ID);
  const voiceChannel = guild?.channels.cache.get(VOICE_CHANNEL_ID);
  if(voiceChannel) {
    voiceChannel.join().then(() => console.log('Bot ses kanalında AFK')).catch(console.log);
  }

  // Kanalları yedekle
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

  // Rolleri yedekle
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

// Kanal silindiğinde geri oluştur
client.on('channelDelete', async channel => {
  const guild = channel.guild;
  const data = backupChannels[channel.id];
  if(data) {
    guild.channels.create({ name: data.name, type: data.type, parent: data.parentId });
  }
  const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
  logChannel?.send(`Kanal silindi: ${channel.name}, geri oluşturuldu.`);
});

// Rol silindiğinde geri oluştur
client.on('roleDelete', async role => {
  const guild = role.guild;
  const data = backupRoles[role.id];
  if(data) {
    guild.roles.create({
      name: data.name,
      color: data.color,
      permissions: data.permissions,
      hoist: data.hoist,
      mentionable: data.mentionable
    });
  }
  const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
  logChannel?.send(`Rol silindi: ${role.name}, geri oluşturuldu.`);
});

// Botu başlat
client.login(process.env.DISCORD_TOKEN);
