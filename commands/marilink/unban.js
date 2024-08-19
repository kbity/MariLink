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
        .setName('unban')
        .setDescription('Unban a user globally or in a specific channel.')
        .addStringOption(option =>
            option.setName('user')
                .setDescription('The user to unban (username, user ID, or mention).')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('channel')
                .setDescription('The MariLink channel name to unban the user from. Leave blank for a global unban.')
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
                await interaction.reply('You do not have permission to unban users in this channel.');
                return;
            }

            // Remove the user from the channel's banned list
            if (channelConfig.banned) {
                channelConfig.banned = channelConfig.banned.filter(id => id !== userId);
                dbData[channelOption] = channelConfig;
            }
        } else {
            // Global unban
            if (!isGlobalAdmin) {
                await interaction.reply('You do not have permission to perform a global unban.');
                return;
            }

            banListData.bannedUserIds = banListData.bannedUserIds.filter(id => id !== userId);

            // Remove the ban across all linked servers
            for (const guild of interaction.client.guilds.cache.values()) {
                try {
                    const member = await guild.members.fetch(userId);
                    if (member) {
                        await guild.members.unban(userId, 'Global unban');
                    }
                } catch (error) {
                    console.error(`Error unbanning user in guild ${guild.id}:`, error);
                }
            }
        }

        // Save the updated data
        fs.writeFileSync('db.json', JSON.stringify(dbData, null, 2));
        fs.writeFileSync('banlist.json', JSON.stringify(banListData, null, 2));

        await interaction.reply(`${user.username} has been unbanned.`);
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

