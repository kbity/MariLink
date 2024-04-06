const fs = require('fs');
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deletechannel')
        .setDescription('Delete Channel from MariLink')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Name of the channel to delete')
                .setRequired(true)),
    async execute(interaction) {
        const name = interaction.options.getString('name');
        const userId = interaction.user.id;

        // Read the existing data from db.json
        let dbData = {};
        try {
            dbData = JSON.parse(fs.readFileSync('db.json'));
        } catch (error) {
            console.error('Error reading db.json:', error);
        }

        // Check if the channel exists and if the user is the creator
        if (dbData[name] && dbData[name].userId === userId) {
            // Delete the channel from dbData
            delete dbData[name];

            // Write the updated data back to db.json
            fs.writeFileSync('db.json', JSON.stringify(dbData, null, 2));

            // Read the updated data from db.json
            dbData = JSON.parse(fs.readFileSync('db.json'));

            if (!dbData[name]) {
                await interaction.reply({ content: `Deleted channel ${name} from MariLink.`, ephemeral: true });
            } else {
                await interaction.reply({ content: `Error deleting channel ${name}. Please try again.`, ephemeral: true });
            }
        } else {
            await interaction.reply({ content: `Channel ${name} not found or you do not have permission to delete it.`, ephemeral: true });
        }
    },
};

