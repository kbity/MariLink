const fs = require('fs');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unlink')
        .setDescription('Unlink Discord channel from MariLink channel')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Name of the MariLink channel')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Discord channel to unlink')
                .setRequired(true)),
    async execute(interaction) {
        // Check if the user has the 'Manage Guild' or 'Administrator' permission
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild) &&
            !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }
        const name = interaction.options.getString('name');
        const channel = interaction.options.getChannel('channel');
        const userId = interaction.user.id;

        // Read the existing data from db.json
        let dbData = {};
        try {
            dbData = JSON.parse(fs.readFileSync('db.json'));
        } catch (error) {
            console.error('Error reading db.json:', error);
        }

        // Check if the MariLink channel exists
        if (dbData[name]) {
            // Check if the Discord channel is linked to the MariLink channel
            if (dbData[name].discordChannelIds && dbData[name].discordChannelIds.includes(channel.id)) {
                // Remove the Discord channel ID from the MariLink channel's entry
                dbData[name].discordChannelIds = dbData[name].discordChannelIds.filter(id => id !== channel.id);

                // Write the updated data back to db.json
                fs.writeFileSync('db.json', JSON.stringify(dbData, null, 2));

                await interaction.reply({ content: `Unlinked Discord channel ${channel.name} from MariLink channel ${name}.`, ephemeral: true });
            } else {
                await interaction.reply({ content: `Discord channel ${channel.name} is not linked to MariLink channel ${name}.`, ephemeral: true });
            }
        } else {
            await interaction.reply({ content: `MariLink channel ${name} not found.`, ephemeral: true });
        }
    },
};

