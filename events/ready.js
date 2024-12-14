const { Events, Client, GatewayIntentBits, ActivityType } = require('discord.js');
const fs = require('fs');
const { startupMessageChannel, startupMessages } = require('../config.json');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(`Ready! Logged in as ${client.user.tag}`);

        client.user.setPresence({ activities: [{ name: 'Initializing...' }], status: 'dnd' });

        // Check for servers owned by banned users
        let banList = [];
        try {
            const banListData = JSON.parse(fs.readFileSync('banlist.json'));
            banList = banListData.bannedUserIds || [];
        } catch (error) {
            console.error('Error reading banlist.json:', error);
        }

        client.guilds.cache.forEach(async (guild) => {
            const ownerId = guild.ownerId;
            if (banList.includes(ownerId)) {
                console.log(`Leaving guild "${guild.name}" (ID: ${guild.id}) as the owner (${ownerId}) is banned.`);
                await guild.leave().catch(err => console.error(`Failed to leave guild "${guild.name}":`, err));
            }
        });

        // Set a recurring presence update
        setInterval(() => {
            client.user.setPresence({
                activities: [
                    {
                        name: 'MariLink v1.2.1',
                        type: ActivityType.Custom,
                    },
                ],
                status: 'online',
            });
        }, 1000);
    },
};

