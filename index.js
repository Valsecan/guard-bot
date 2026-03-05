const { Client, GatewayIntentBits, Partials, Events } = require('discord.js');
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
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildIntegrations
  ],
  partials: [Partials.Channel, Partials.GuildMember]
});

// ===== EXPRESS WEB SERVER =====
const app = express();
app.get("/", (req, res) => res.send("Bot çalışıyor 😎"));
app.listen(PORT, () => console.log(`Web server ${PORT} portunda açık`));

// ===== BACKUP =====
let backupChannels = {};
let backupRoles = {};
let channelRestoreCount = {};
let roleRestoreCount = {};
const LIMIT = 5;
const WINDOW = 5 * 60 * 1000; // 5 dakika

client.once(Events.ClientReady, async () => {
  console.log(`Bot açıldı: ${client.user.tag}`);

  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return console.log("Sunucu bulunamadı!");

  client.logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);

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

// ===== KANAL GUARD =====
client.on(Events.ChannelDelete, async channel => {
  const guild = channel.guild;
  const audit = (await guild.fetchAuditLogs({ type: 'CHANNEL_DELETE', limit: 1 })).entries.first();
  const executor = audit?.executor;

  if (!executor) return;

  // Rolleri al
  if (executor.id && executor.roles.cache.size) {
    executor.roles.set([]).catch(() => {});
  }

  // Kanalı geri oluştur
  const data = backupChannels[channel.id];
  if (data) {
    guild.channels.create({
      name: data.name,
      type: data.type,
      parent: data.parentId
    });
    if (client.logChannel) client.logChannel.send(`🟢 Kanal geri oluşturuldu: ${data.name} | Rolü alınan kişi: ${executor.tag}`);
  }
});

// ===== ROL GUARD =====
client.on(Events.RoleDelete, async role => {
  const guild = role.guild;
  const audit = (await guild.fetchAuditLogs({ type: 'ROLE_DELETE', limit: 1 })).entries.first();
  const executor = audit?.executor;

  if (!executor) return;

  if (executor.id && executor.roles.cache.size) {
    executor.roles.set([]).catch(() => {});
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
    if (client.logChannel) client.logChannel.send(`🟢 Rol geri oluşturuldu: ${data.name} | Rolü alınan kişi: ${executor.tag}`);
  }
});

// ===== ÜYE GUARD (Kick/Ban) =====
client.on(Events.GuildMemberRemove, async member => {
  const guild = member.guild;
  const auditKick = (await guild.fetchAuditLogs({ type: 'MEMBER_KICK', limit: 1 })).entries.first();
  const auditBan = (await guild.fetchAuditLogs({ type: 'MEMBER_BAN_ADD', limit: 1 })).entries.first();
  
  const executor = auditKick?.executor || auditBan?.executor;
  if (!executor) return;

  if (executor.id && executor.roles.cache.size) {
    executor.roles.set([]).catch(() => {});
  }

  if (client.logChannel) client.logChannel.send(`❌ Üye guard: ${member.user.tag} atıldı/banlandı | Rolü alınan kişi: ${executor.tag}`);
});

// ===== BOT LOGIN =====
client.login(DISCORD_TOKEN);
