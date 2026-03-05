console.log("bot çalışıyor")
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const express = require('express');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.GuildModeration
  ],
  partials: [Partials.Channel]
});

const GUILD_ID = '1462552916660588779';
const VOICE_CHANNEL_ID = '1462552917587529844';
const LOG_CHANNEL_ID = '1479089590177501264';
const LIMIT = 5;
const WINDOW = 5 * 60 * 1000;
let channelRestoreCount = {};
let roleRestoreCount = {};
let backupChannels = {};
let backupRoles = {};

const PORT = process.env.PORT || 3000;

const app = express();
app.get('/', (req,res) => res.send('Bot çalışıyor 😎'));
app.listen(PORT, () => console.log(`Web server ${PORT} portunda açık`));

client.once('ready', async () => {
  console.log(`Bot açıldı: ${client.user.tag}`);
  client.user.setStatus('idle');

  const guild = client.guilds.cache.get(GUILD_ID);
  const voiceChannel = guild.channels.cache.get(VOICE_CHANNEL_ID);
  if (voiceChannel) voiceChannel.join().then(() => console.log('Bot ses kanalına girdi ve AFK kaldı'));

  guild.channels.cache.forEach(ch => {
    backupChannels[ch.id] = {
      name: ch.name,
      type: ch.type,
      parentId: ch.parentId,
      permissions: ch.permissionOverwrites.cache.map(p => ({
        id: p.id, allow: p.allow.bitfield, deny: p.deny.bitfield
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

client.on('channelDelete', async channel => {
  const guild = channel.guild;
  const userId = channel.lastMessage?.author?.id || 'unknown';

  channelRestoreCount[userId] = (channelRestoreCount[userId] || 0) + 1;
  if(channelRestoreCount[userId] > LIMIT){
    const member = guild.members.cache.get(userId);
    if(member) member.kick('Guard limit aşıldı');
    return;
  }
  setTimeout(() => channelRestoreCount[userId]--, WINDOW);

  const data = backupChannels[channel.id];
  if(data){
    guild.channels.create({ name: data.name, type: data.type, parent: data.parentId }).then(ch => {
      const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
      if(logChannel) logChannel.send(`Kanal geri oluşturuldu: ${ch.name}`);
    });
  }
});

client.on('roleDelete', async role => {
  const guild = role.guild;
  const userId = role.guild.me?.id || 'unknown';

  roleRestoreCount[userId] = (roleRestoreCount[userId] || 0) + 1;
  if(roleRestoreCount[userId] > LIMIT){
    const member = guild.members.cache.get(userId);
    if(member) member.kick('Guard limit aşıldı');
    return;
  }
  setTimeout(() => roleRestoreCount[userId]--, WINDOW);

  const data = backupRoles[role.id];
  if(data){
    guild.roles.create({
      name: data.name,
      color: data.color,
      permissions: data.permissions,
      hoist: data.hoist,
      mentionable: data.mentionable
    }).then(r => {
      const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
      if(logChannel) logChannel.send(`Rol geri oluşturuldu: ${r.name}`);
    });
  }
});

client.login(process.env.DISCORD_TOKEN);
