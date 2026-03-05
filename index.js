// index.js
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const express = require('express');

// ===== ENV DEĞİŞKENLERİ =====
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
const PORT = process.env.PORT || 3000;

// ===== CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.GuildModeration
  ],
  partials: [Partials.Channel, Partials.GuildMember]
});

// ===== WEB SERVER =====
const app = express();
app.get("/", (req, res) => res.send("Bot çalışıyor 😎"));
app.listen(PORT, () => console.log(`Web server ${PORT} portunda açık`));

// ===== READY EVENT =====
client.once('ready', () => {
  console.log(`Bot açıldı: ${client.user.tag}`);
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return console.log('Sunucu bulunamadı!');
  client.logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
});

// ===== Yedekleme =====
let backupChannels = {};
let backupRoles = {};

// Sunucu yedeğini hazırla
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

// ===== KANAL GUARD =====
client.on('channelDelete', async channel => {
  const guild = channel.guild;
  try {
    const audit = await guild.fetchAuditLogs({ type: 'CHANNEL_DELETE', limit: 1 });
    const executor = audit.entries.first()?.executor;
    if (executor) {
      const member = guild.members.cache.get(executor.id);
      if (member) member.roles.cache.forEach(r => member.roles.remove(r).catch(()=>{}));
    }
    const data = backupChannels[channel.id];
    if (data) {
      guild.channels.create({ name: data.name, type: data.type, parent: data.parentId });
      if (client.logChannel) client.logChannel.send(`🟢 Kanal geri oluşturuldu: ${data.name} | Silen: ${executor?.tag}`);
    }
  } catch (err) {
    console.log('channelDelete hata:', err);
  }
});

client.on('channelCreate', async channel => {
  const guild = channel.guild;
  try {
    const audit = await guild.fetchAuditLogs({ type: 'CHANNEL_CREATE', limit: 1 });
    const executor = audit.entries.first()?.executor;
    if (executor) {
      const member = guild.members.cache.get(executor.id);
      if (member) member.roles.cache.forEach(r => member.roles.remove(r).catch(()=>{}));
      if (client.logChannel) client.logChannel.send(`⚠️ Kanal oluşturuldu: ${channel.name} | Rolü alınan: ${executor.tag}`);
    }
  } catch (err) { console.log('channelCreate hata:', err); }
});

// ===== ROL GUARD =====
client.on('roleDelete', async role => {
  const guild = role.guild;
  try {
    const audit = await guild.fetchAuditLogs({ type: 'ROLE_DELETE', limit: 1 });
    const executor = audit.entries.first()?.executor;
    if (executor) {
      const member = guild.members.cache.get(executor.id);
      if (member) member.roles.cache.forEach(r => member.roles.remove(r).catch(()=>{}));
    }
    const data = backupRoles[role.id];
    if (data) {
      guild.roles.create({
        name: data.name,
        color: data.color,
        permissions: data.permissions,
        hoist: data.hoist,
        mentionable: data.mentionable
      });
      if (client.logChannel) client.logChannel.send(`🟢 Rol geri oluşturuldu: ${data.name} | Silen: ${executor?.tag}`);
    }
  } catch (err) { console.log('roleDelete hata:', err); }
});

client.on('roleCreate', async role => {
  const guild = role.guild;
  try {
    const audit = await guild.fetchAuditLogs({ type: 'ROLE_CREATE', limit: 1 });
    const executor = audit.entries.first()?.executor;
    if (executor) {
      const member = guild.members.cache.get(executor.id);
      if (member) member.roles.cache.forEach(r => member.roles.remove(r).catch(()=>{}));
      if (client.logChannel) client.logChannel.send(`⚠️ Rol oluşturuldu: ${role.name} | Rolü alınan: ${executor.tag}`);
    }
  } catch (err) { console.log('roleCreate hata:', err); }
});

// ===== ÜYE KORUMA (Kick ve Ban) =====
client.on('guildMemberRemove', async member => {
  const guild = member.guild;
  try {
    const audit = await guild.fetchAuditLogs({ type: 'MEMBER_KICK', limit: 1 });
    const executor = audit.entries.first()?.executor;
    if (executor) {
      const memberExec = guild.members.cache.get(executor.id);
      if (memberExec) memberExec.roles.cache.forEach(r => memberExec.roles.remove(r).catch(()=>{}));
      if (client.logChannel) client.logChannel.send(`⚠️ ${executor.tag} birini attı, tüm rolleri alındı.`);
    }
  } catch (err) { console.log('guildMemberRemove hata:', err); }
});

client.on('guildBanAdd', async (guild, ban) => {
  try {
    const audit = await guild.fetchAuditLogs({ type: 'MEMBER_BAN_ADD', limit: 1 });
    const executor = audit.entries.first()?.executor;
    if (executor) {
      const memberExec = guild.members.cache.get(executor.id);
      if (memberExec) memberExec.roles.cache.forEach(r => memberExec.roles.remove(r).catch(()=>{}));
      if (client.logChannel) client.logChannel.send(`⚠️ ${executor.tag} birini banladı, tüm rolleri alındı.`);
    }
  } catch (err) { console.log('guildBanAdd hata:', err); }
});

// ===== BOT LOGIN =====
client.login(DISCORD_TOKEN);
