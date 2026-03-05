const { Client, GatewayIntentBits, Partials, PermissionsBitField } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const express = require('express');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildBans
    ],
    partials: [Partials.Channel]
});

// ===== AYARLAR =====
const GUILD_ID = '1462552916660588779'; // Sunucu ID
const VOICE_CHANNEL_ID = '1462552917587529844'; // Ses kanal ID
const LOG_CHANNEL_ID = '1479089590177501264'; // Log kanalı
const LIMIT = 5; // 5 dakikada max 5 silme
const WINDOW = 5 * 60 * 1000; // 5 dakika
let channelRestoreCount = {};
let roleRestoreCount = {};
let backupChannels = {};
let backupRoles = {};

// ===== WEB SERVER =====
const app = express();
app.get('/', (req, res) => res.send('Bot çalışıyor 😎'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Web server ${PORT} portunda açık`));

// ===== BOT BAŞLANGIÇ =====
client.once('ready', async () => {
    console.log(`Bot açıldı: ${client.user.tag}`);
    client.user.setStatus('idle');

    const guild = await client.guilds.fetch(GUILD_ID);

    // SES KANALINA GİRİŞ
    try {
        joinVoiceChannel({
            channelId: VOICE_CHANNEL_ID,
            guildId: GUILD_ID,
            adapterCreator: guild.voiceAdapterCreator
        });
        console.log('Bot ses kanalına girdi ve AFK kaldı');
    } catch (e) {
        console.log('Ses kanalına girerken hata:', e);
    }

    // KANALLARI VE ROLLERİ YEDEKLE
    const channels = await guild.channels.fetch();
    channels.forEach(ch => {
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

    const roles = await guild.roles.fetch();
    roles.forEach(r => {
        backupRoles[r.id] = {
            name: r.name,
            color: r.color,
            permissions: r.permissions.bitfield,
            hoist: r.hoist,
            mentionable: r.mentionable
        };
    });
});

// ===== KANAL SİLME EVENTİ =====
client.on('channelDelete', async channel => {
    const guild = channel.guild;
    const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);

    const userId = 'unknown'; // audit log ile geliştirilebilir
    channelRestoreCount[userId] = (channelRestoreCount[userId] || 0) + 1;

    if(channelRestoreCount[userId] > LIMIT){
        const member = guild.members.cache.get(userId);
        if(member) member.roles.set([]); // rolleri al
        if(logChannel) logChannel.send(`Guard limit aşıldı ve ${userId} rollerini kaybetti`);
        return;
    }
    setTimeout(() => channelRestoreCount[userId]--, WINDOW);

    const data = backupChannels[channel.id];
    if(data){
        guild.channels.create({
            name: data.name,
            type: data.type,
            parent: data.parentId,
            permissionOverwrites: data.permissions.map(p => ({
                id: p.id,
                allow: p.allow,
                deny: p.deny
            }))
        }).then(() => {
            if(logChannel) logChannel.send(`Kanal geri oluşturuldu: ${data.name}`);
        });
    }
});

// ===== ROL SİLME EVENTİ =====
client.on('roleDelete', async role => {
    const guild = role.guild;
    const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);

    const userId = 'unknown';
    roleRestoreCount[userId] = (roleRestoreCount[userId] || 0) + 1;

    if(roleRestoreCount[userId] > LIMIT){
        const member = guild.members.cache.get(userId);
        if(member) member.roles.set([]);
        if(logChannel) logChannel.send(`Guard limit aşıldı ve ${userId} rollerini kaybetti`);
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
        }).then(() => {
            if(logChannel) logChannel.send(`Rol geri oluşturuldu: ${data.name}`);
        });
    }
});

// ===== BOTU BAŞLAT =====
client.login(process.env.DISCORD_TOKEN);
