const { SlashCommandBuilder } = require('@discordjs/builders');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('promote')
        .setDescription('Promote a user to a specific role.')
        .addStringOption(option =>
            option.setName('user')
                .setDescription('The user to promote (username, user ID, or mention).')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('role')
                .setDescription('The role to promote the user to.')
                .setRequired(true)
                .addChoices(
                    { name: 'Global Admin', value: 'globalAdmin' },
                    { name: 'Local Admin', value: 'localAdmin' },
                    { name: 'Local Operator', value: 'localOperator' }
                ))
        .addStringOption(option =>
            option.setName('channel')
                .setDescription('The MariLink channel name for local roles. Leave blank for global roles.')
                .setRequired(false)),

    async execute(interaction) {
        const userOption = interaction.options.getString('user');
        const roleOption = interaction.options.getString('role');
        const channelOption = interaction.options.getString('channel');

        let dbData = {};

        try {
            dbData = JSON.parse(fs.readFileSync('db.json'));
        } catch (error) {
            console.error('Error reading db.json:', error);
            await interaction.reply('An error occurred while accessing the database.');
            return;
        }

        const user = await resolveUser(userOption, interaction);
        if (!user) {
            await interaction.reply('User not found.');
            return;
        }

        const userId = user.id;
        const isGlobalAdmin = dbData.globalAdmins && dbData.globalAdmins.includes(interaction.user.id);

        if (roleOption === 'globalAdmin') {
            if (!isGlobalAdmin) {
                await interaction.reply('You do not have permission to promote users to globalAdmin.');
                return;
            }
            if (!dbData.globalAdmins) {
                dbData.globalAdmins = [];
            }
            if (!dbData.globalAdmins.includes(userId)) {
                dbData.globalAdmins.push(userId);
            }
        } else {
            if (!channelOption) {
                await interaction.reply('You must specify a channel for local roles.');
                return;
            }
            const channelConfig = dbData[channelOption];
            if (!channelConfig) {
                await interaction.reply('Channel not found.');
                return;
            }

            const isChannelOwner = channelConfig.userId === interaction.user.id;
            const isLocalAdmin = channelConfig.localAdmins && channelConfig.localAdmins.includes(interaction.user.id);

            if (roleOption === 'localAdmin') {
                if (!isGlobalAdmin && !isChannelOwner) {
                    await interaction.reply('You do not have permission to promote users to localAdmin.');
                    return;
                }
                if (!channelConfig.localAdmins) {
                    channelConfig.localAdmins = [];
                }
                if (!channelConfig.localAdmins.includes(userId)) {
                    channelConfig.localAdmins.push(userId);
                }
            } else if (roleOption === 'localOperator') {
                if (!isGlobalAdmin && !isChannelOwner && !isLocalAdmin) {
                    await interaction.reply('You do not have permission to promote users to localOperator.');
                    return;
                }
                if (!channelConfig.localOperators) {
                    channelConfig.localOperators = [];
                }
                if (!channelConfig.localOperators.includes(userId)) {
                    channelConfig.localOperators.push(userId);
                }
            } else {
                await interaction.reply('Invalid role specified.');
                return;
            }

            dbData[channelOption] = channelConfig;
        }

        // Save the updated data
        fs.writeFileSync('db.json', JSON.stringify(dbData, null, 2));

        await interaction.reply(`${user.username} has been promoted to ${roleOption}.`);
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

