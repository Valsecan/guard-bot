const { Client, GatewayIntentBits, AuditLogEvent, ChannelType } = require("discord.js");
const express = require("express");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const OWNER_ID = "1467082213890719837";
const LOG_CHANNEL = "1479089590177501264";

const app = express();

app.get("/", (req, res) => {
  res.send("Bot çalışıyor");
});

app.listen(8080, () => {
  console.log("Web server çalışıyor");
});

client.once("clientReady", () => {
  console.log(`Bot açıldı: ${client.user.tag}`);
});

async function punish(guild, userId, reason) {

  if (userId === OWNER_ID) return;

  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return;

  try {

    await member.roles.set([]);

    const log = guild.channels.cache.get(LOG_CHANNEL);

    if (log) {
      log.send(`🚨 GUARD

Kullanıcı: <@${userId}>
Sebep: ${reason}

Tüm rolleri alındı.`);
    }

  } catch (err) {
    console.log(err);
  }
}

client.on("channelCreate", async (channel) => {

  setTimeout(async () => {

    const logs = await channel.guild.fetchAuditLogs({
      type: AuditLogEvent.ChannelCreate,
      limit: 1
    });

    const entry = logs.entries.first();
    if (!entry) return;

    punish(channel.guild, entry.executor.id, "İzinsiz kanal açtı");

  }, 1000);

});

client.on("channelDelete", async (channel) => {

  setTimeout(async () => {

    const logs = await channel.guild.fetchAuditLogs({
      type: AuditLogEvent.ChannelDelete,
      limit: 1
    });

    const entry = logs.entries.first();
    if (!entry) return;

    punish(channel.guild, entry.executor.id, "Kanal sildi");

    try {

      if (channel.type === ChannelType.GuildText) {

        await channel.guild.channels.create({
          name: channel.name,
          type: ChannelType.GuildText,
          parent: channel.parentId,
          topic: channel.topic,
          nsfw: channel.nsfw,
          rateLimitPerUser: channel.rateLimitPerUser
        });

      }

      if (channel.type === ChannelType.GuildVoice) {

        await channel.guild.channels.create({
          name: channel.name,
          type: ChannelType.GuildVoice,
          parent: channel.parentId,
          bitrate: channel.bitrate,
          userLimit: channel.userLimit
        });

      }

    } catch (err) {
      console.log(err);
    }

  }, 1000);

});

client.on("roleCreate", async (role) => {

  setTimeout(async () => {

    const logs = await role.guild.fetchAuditLogs({
      type: AuditLogEvent.RoleCreate,
      limit: 1
    });

    const entry = logs.entries.first();
    if (!entry) return;

    punish(role.guild, entry.executor.id, "Rol oluşturdu");

  }, 1000);

});

client.on("roleDelete", async (role) => {

  setTimeout(async () => {

    const logs = await role.guild.fetchAuditLogs({
      type: AuditLogEvent.RoleDelete,
      limit: 1
    });

    const entry = logs.entries.first();
    if (!entry) return;

    punish(role.guild, entry.executor.id, "Rol sildi");

    try {

      await role.guild.roles.create({
        name: role.name,
        color: role.color,
        hoist: role.hoist,
        permissions: role.permissions,
        mentionable: role.mentionable
      });

    } catch (err) {
      console.log(err);
    }

  }, 1000);

});

client.login(process.env.TOKEN);
