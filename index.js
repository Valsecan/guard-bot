// index.js
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const express = require('express');

// ===== ENV =====
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

// ===== CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.GuildMember, Partials.Channel]
});

// ===== WEB SERVER =====
const app = express();
app.get('/', (req, res) => res.send('Bot çalışıyor 😎'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Web server ${PORT} portunda açık`));

// ===== BACKUP =====
let backupChannels = {};
let backupRoles = {};

// ===== READY =====
client.once('clientReady', () => {
  console.log(`Bot açıldı: ${client.user.tag}`);
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return console.log('Sunucu bulunamadı!');

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

  // Log kanalı
  client.logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
});

// ===== CHANNEL GUARD =====
client.on('channelDelete', async channel => {
  const guild = channel.guild;
  const data = backupChannels[channel.id];
  if (!data) return;
  guild.channels.create({
    name: data.name,
    type: data.type,
    parent: data.parentId
  }).then(ch => {
    if (client.logChannel) client.logChannel.send(`🟢 Kanal geri oluşturuldu: ${data.name}`);
  });
});

client.on('channelCreate', async channel => {
  const guild = channel.guild;
  const audit = await guild.fetchAuditLogs({ type: 'CHANNEL_CREATE', limit: 1 });
  const executor = audit.entries.first()?.executor;
  if (executor && executor.id !== client.user.id) {
    const member = guild.members.cache.get(executor.id);
    if (member) member.roles.cache.forEach(r => member.roles.remove(r).catch(()=>{}));
    if (client.logChannel) client.logChannel.send(`⚠️ ${executor.tag} kanalı açtı, rolleri alındı!`);
  }
});

// ===== ROLE GUARD =====
client.on('roleDelete', async role => {
  const guild = role.guild;
  const data = backupRoles[role.id];
  if (!data) return;
  guild.roles.create({
    name: data.name,
    color: data.color,
    permissions: data.permissions,
    hoist: data.hoist,
    mentionable: data.mentionable
  }).then(r => {
    if (client.logChannel) client.logChannel.send(`🟢 Rol geri oluşturuldu: ${data.name}`);
  });
});

client.on('roleCreate', async role => {
  const guild = role.guild;
  const audit = await guild.fetchAuditLogs({ type: 'ROLE_CREATE', limit: 1 });
  const executor = audit.entries.first()?.executor;
  if (executor && executor.id !== client.user.id) {
    const member = guild.members.cache.get(executor.id);
    if (member) member.roles.cache.forEach(r => member.roles.remove(r).catch(()=>{}));
    if (client.logChannel) client.logChannel.send(`⚠️ ${executor.tag} rol açtı, rolleri alındı!`);
  }
});

// ===== MEMBER GUARD =====
client.on('guildMemberRemove', member => {
  if (client.logChannel) client.logChannel.send(`⚠️ ${member.user.tag} sunucudan atıldı, rolleri alınamadı!`);
});

client.on('guildMemberUpdate', (oldMember, newMember) => {
  if (oldMember.roles.cache.size < newMember.roles.cache.size) {
    const added = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
    const executor = newMember.guild.members.cache.get(newMember.id);
    if (executor) executor.roles.cache.forEach(r => executor.roles.remove(r).catch(()=>{}));
    if (client.logChannel && added.size > 0) client.logChannel.send(`⚠️ ${newMember.user.tag} rol aldı, rolleri alındı!`);
  }
});

// ===== LOGIN =====
client.login(DISCORD_TOKEN);
