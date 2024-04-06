const fs = require('fs');
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('createchannel')
        .setDescription('Add Channel into MariLink')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Name of the channel')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('password')
                .setDescription('Password for the channel')
                .setRequired(false)),
    async execute(interaction) {
        const name = interaction.options.getString('name');
        const password = interaction.options.getString('password');
        const userId = interaction.user.id;

        // Read the existing data from db.json
        let dbData = {};
        try {
            dbData = JSON.parse(fs.readFileSync('db.json'));
        } catch (error) {
            console.error('Error reading db.json:', error);
        }

        // Check if the channel name already exists
        if (dbData[name]) {
                    await interaction.reply({ content: `Channel ${name} already exists.`, ephemeral: true });
            return;
        }

        // Add the new channel data to dbData
        dbData[name] = { password: password, userId: userId };

        // Write the updated data back to db.json
        fs.writeFileSync('db.json', JSON.stringify(dbData, null, 2));

        await interaction.reply({ content: `Added channel ${name} to MariLink.`, ephemeral: true });
    },
};
