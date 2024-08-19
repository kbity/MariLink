const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const { WebhookClient } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('delete')
        .setDescription('Delete a message across all mirrored channels.')
        .addStringOption(option => 
            option.setName('messageid')
                .setDescription('The ID of the message to delete (proxy or original)')
                .setRequired(true)),
    async execute(interaction) {
        const messageId = interaction.options.getString('messageid');
        const userId = interaction.user.id;

        let dbData = {};
        try {
            dbData = JSON.parse(fs.readFileSync('db.json'));
        } catch (error) {
            console.error('Error reading db.json:', error);
            await interaction.reply({ content: 'Internal error while accessing database.', ephemeral: true });
            return;
        }

        let messageData = {};
        try {
            messageData = JSON.parse(fs.readFileSync('messages.json'));
        } catch (error) {
            console.error('Error reading messages.json:', error);
            await interaction.reply({ content: 'Internal error while accessing message data.', ephemeral: true });
            return;
        }

        let targetMessageInfo = null;
        let originalMessageId = null;

        // Try to find the proxy message ID
        for (const [originalId, mirroredMessages] of Object.entries(messageData)) {
            for (const [targetChannelId, messageInfo] of Object.entries(mirroredMessages)) {
                if (messageInfo.id === messageId) {
                    targetMessageInfo = { originalId, targetChannelId, ...messageInfo };
                    break;
                }
            }
            if (targetMessageInfo) break;
        }

        // If not found, try to find using the original message ID
        if (!targetMessageInfo) {
            originalMessageId = messageId;
            if (messageData[originalMessageId]) {
                for (const [targetChannelId, messageInfo] of Object.entries(messageData[originalMessageId])) {
                    targetMessageInfo = { originalId: originalMessageId, targetChannelId, ...messageInfo };
                    break;
                }
            }
        }

        if (!targetMessageInfo) {
            await interaction.reply({ content: 'Message not found or has already been deleted.', ephemeral: true });
            return;
        }

        const { targetChannelId, id: mirroredMessageId, webhookId, webhookToken } = targetMessageInfo;

        let messageChannelConfig = null;
        const messageChannelId = interaction.channel.id;

        for (const channelConfig of Object.values(dbData)) {
            if (channelConfig.discordChannelIds && channelConfig.discordChannelIds.includes(messageChannelId)) {
                messageChannelConfig = channelConfig;
                break;
            }
        }

        if (!messageChannelConfig) {
            await interaction.reply({ content: 'Channel configuration not found.', ephemeral: true });
            return;
        }

        const hasPermission = (userId) => {
            const isGlobalAdmin = dbData.globalAdmins && dbData.globalAdmins.includes(userId);
            const isChannelOwner = messageChannelConfig.userId === userId;
            const isLocalAdmin = messageChannelConfig.localAdmins && messageChannelConfig.localAdmins.includes(userId);
            const isLocalOperator = messageChannelConfig.localOperators && messageChannelConfig.localOperators.includes(userId);

            return isGlobalAdmin || isChannelOwner || isLocalAdmin || isLocalOperator;
        };

        if (!hasPermission(userId)) {
            await interaction.reply({ content: 'You do not have permission to delete this message.', ephemeral: true });
            return;
        }

        try {
            const targetChannel = await interaction.client.channels.fetch(targetChannelId);
            if (targetChannel) {
                if (webhookId && webhookToken) {
                    const webhookClient = new WebhookClient({ id: webhookId, token: webhookToken });
                    await webhookClient.deleteMessage(mirroredMessageId);
                } else {
                    const targetMessage = await targetChannel.messages.fetch(mirroredMessageId);
                    await targetMessage.delete();
                }
            }
        } catch (error) {
            console.error(`Error deleting mirrored message in channel ID ${targetChannelId}:`, error);
        }

        delete messageData[targetMessageInfo.originalId][targetChannelId];
        if (Object.keys(messageData[targetMessageInfo.originalId]).length === 0) {
            delete messageData[targetMessageInfo.originalId];
        }
        fs.writeFileSync('messages.json', JSON.stringify(messageData, null, 2));

        await interaction.reply({ content: 'Message successfully deleted across all mirrored channels.', ephemeral: true });
    },
};

