const { SlashCommandBuilder } = require('@discordjs/builders');
const fs = require('fs');

let banList = [];
try {
    const banListData = JSON.parse(fs.readFileSync('banlist.json'));
    banList = banListData.bannedUserIds || [];
} catch (error) {
    console.error('Error reading banlist.json:', error);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a user globally or in a specific channel.')
        .addStringOption(option =>
            option.setName('user')
                .setDescription('The user to ban (username, user ID, or mention).')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('channel')
                .setDescription('The MariLink channel name to ban the user from. Leave blank for a global ban.')
                .setRequired(false)),

    async execute(interaction) {
        const userOption = interaction.options.getString('user');
        const channelOption = interaction.options.getString('channel');

        let dbData = {};
        let banListData = { bannedUserIds: [] };

        try {
            dbData = JSON.parse(fs.readFileSync('db.json'));
        } catch (error) {
            console.error('Error reading db.json:', error);
            await interaction.reply('An error occurred while accessing the database.');
            return;
        }

        try {
            banListData = JSON.parse(fs.readFileSync('banlist.json'));
        } catch (error) {
            console.error('Error reading banlist.json:', error);
        }

        const user = await resolveUser(userOption, interaction);
        if (!user) {
            await interaction.reply('User not found.');
            return;
        }

        const userId = user.id;
        const isGlobalAdmin = dbData.globalAdmins && dbData.globalAdmins.includes(interaction.user.id);

        if (channelOption) {
            const channelConfig = dbData[channelOption];
            if (!channelConfig) {
                await interaction.reply('Channel not found.');
                return;
            }

            const isChannelAdmin = channelConfig.localAdmins && channelConfig.localAdmins.includes(interaction.user.id);

            if (!isGlobalAdmin && !isChannelAdmin) {
                await interaction.reply('You do not have permission to ban users in this channel.');
                return;
            }

            // Add the user to the channel's banned list
            if (!channelConfig.banned) {
                channelConfig.banned = [];
            }
            channelConfig.banned.push(userId);
            dbData[channelOption] = channelConfig;
        } else {
            // Global ban
            if (!isGlobalAdmin) {
                await interaction.reply('You do not have permission to perform a global ban.');
                return;
            }

            if (!banListData.bannedUserIds.includes(userId)) {
                banListData.bannedUserIds.push(userId);
            }

            // Apply the ban across all linked servers
            for (const guild of interaction.client.guilds.cache.values()) {
                try {
                    const member = await guild.members.fetch(userId);
                    if (member) {
                        await member.ban({ reason: 'Global ban' });
                    }
                } catch (error) {
                    console.error(`Error banning user in guild ${guild.id}:`, error);
                }
            }
        }

        // Save the updated data
        fs.writeFileSync('db.json', JSON.stringify(dbData, null, 2));
        fs.writeFileSync('banlist.json', JSON.stringify(banListData, null, 2));

        await interaction.reply(`${user.username} has been banned.`);
    }
};

async function resolveUser(userOption, interaction) {
    const userId = userOption.replace(/[<@!>]/g, '');

    // Attempt to fetch by ID first
    let user = await interaction.client.users.fetch(userId).catch(() => null);

    // If not found by ID, search by username
    if (!user) {
        for (const guild of interaction.client.guilds.cache.values()) {
            const members = await guild.members.fetch();
            user = members.find(member => member.user.username.toLowerCase() === userOption.toLowerCase())?.user;
            if (user) break;
        }
    }

    return user;
}

