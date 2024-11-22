const fs = require('fs');
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deletechannel')
        .setDescription('Delete Channel from MariLink')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Name of the channel to delete')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('confirm')
                .setDescription('Type "Delete this channel" to confirm deletion')
                .setRequired(false)),
    async execute(interaction) {
        const name = interaction.options.getString('name');
        const confirm = interaction.options.getString('confirm');
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
            // Check if the confirm option is correct
            if (confirm === 'Delete this channel') {
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
                await interaction.reply({ content: `To delete this channel, resend this command with "Delete this channel" typed into the optional confirm option. If you changed your mind, this channel is still there.`, ephemeral: true });
            }
        } else {
            await interaction.reply({ content: `Channel ${name} not found or you do not have permission to delete it.`, ephemeral: true });
        }
    },
};
