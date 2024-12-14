const fs = require('fs');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('link')
        .setDescription('Link Discord channel(s) to MariLink channel')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Name of the MariLink channel')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Discord channel to link')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('password')
                .setDescription('Password for the MariLink channel')
                .setRequired(false)),
    async execute(interaction) {
        let banList = [];
        try {
            const banListData = JSON.parse(fs.readFileSync('banlist.json'));
            banList = banListData.bannedUserIds || [];
        } catch (error) {
            console.error('Error reading banlist.json:', error);
        }

        // Check if the user is banned
        if (banList.includes(interaction.user.id)) {
            console.error(`Banned user ${interaction.user.id} attempted to use the /link command.`);
            return interaction.reply({ content: '``` The AC power adapter wattage and type cannot be determined.\n The battery may not charge.\n The system will adjust to performance to match the power available.\n\n Please connect a Dell 65W AC adapter or greater for best system performance.\n\n To resolve this issue, try to reseat the power adapter.\n\n Strike the F3 key (before the F1 or F2 key) if you do not want to see \n power warning messages again\n\n Strike the F1 key to continue, F2 to run the setup utility\n Press F5 to run onboard diagnostics.\n```', ephemeral: false });
        }

        // Check if the user has the 'Manage Guild' or 'Administrator' permission
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild) &&
            !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }
        const name = interaction.options.getString('name');
        const password = interaction.options.getString('password');
        const channel = interaction.options.getChannel('channel');
        const userId = interaction.user.id;

        // Read the existing data from db.json
        let dbData = {};
        try {
            dbData = JSON.parse(fs.readFileSync('db.json'));
        } catch (error) {
            console.error('Error reading db.json:', error);
        }

        // Check if the MariLink channel exists and the password matches
        if (dbData[name] && dbData[name].password === password) {
            // Initialize an array to store Discord channel IDs if not already present
            if (!dbData[name].discordChannelIds) {
                dbData[name].discordChannelIds = [];
            }

            // Check if the channel is already linked
            if (dbData[name].discordChannelIds.includes(channel.id)) {
                await interaction.reply({ content: `Discord channel ${channel.name} is already linked to MariLink channel ${name}.`, ephemeral: true });
            } else {
                // Add the Discord channel ID to the MariLink channel's entry
                dbData[name].discordChannelIds.push(channel.id);

                // Write the updated data back to db.json
                fs.writeFileSync('db.json', JSON.stringify(dbData, null, 2));

                await interaction.reply({ content: `Linked Discord channel ${channel.name} to MariLink channel ${name}.`, ephemeral: true });
            }
        } else {
            await interaction.reply({ content: `MariLink channel ${name} not found or password incorrect.`, ephemeral: true });
        }
    },
};

