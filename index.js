process.on('uncaughtException', function(exception) {
    console.log(exception)
});

const { fetch, setGlobalDispatcher, Agent } = require ('undici')
setGlobalDispatcher(new Agent({ connect: { timeout: 60_000 } }) )

const fs = require('fs');
const path = require('node:path');
const {
    Client,
    Intents,
    MessageEmbed,
    Collection,
    GatewayIntentBits,
    createWebhook
} = require('discord.js');
const {
    token
} = require('./config.json');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent // Required to read message content
    ]
});

client.commands = new Collection();
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
}

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

client.on('messageCreate', async (message) => {
    // Check if the message is sent by the Marilink bot or a webhook
    if (message.author.id === '1225905087352672298' || message.webhookId) {
        return; // Skip processing messages sent by the Marilink bot or webhooks
    }

    // console.log('[DEBUG] Message read'); uncomment for debug

    // Read the existing data from db.json
    let dbData = {};
    try {
        dbData = JSON.parse(fs.readFileSync('db.json'));
    } catch (error) {
        console.error('Error reading db.json:', error);
        return;
    }

    // Find the MariLink Channel configuration for the message's channel
    let messageChannelId = message.channel.id;
    let messageChannelConfig = null;

    for (const channelConfig of Object.values(dbData)) {
        if (channelConfig.discordChannelIds && channelConfig.discordChannelIds.includes(messageChannelId)) {
            messageChannelConfig = channelConfig;
            break;
        }
    }

    if (!messageChannelConfig) {
        return; // Exit if the message channel is not linked to any MariLink Channel
    }

    // Get the target channel IDs for mirroring
    let targetChannelIds = messageChannelConfig.discordChannelIds.filter(channelId => channelId !== messageChannelId);

    // Mirror the message to the target channels
    for (const targetChannelId of targetChannelIds) {
        const targetChannel = await client.channels.fetch(targetChannelId);
        if (targetChannel) {
            // console.log('[DEBUG] Mirroring message to channel:', targetChannel.name); uncomment for debug

            // Prepare the content for the mirrored message
            let mirroredContent = `${message.author.username}: ${message.content}`;
            let mirroredContenthooked = `${message.content}`;

            // Include attachments in the mirrored message
            message.attachments.forEach(attachment => {
                mirroredContent += `\n\nAttachment: ${attachment.url}`;
                mirroredContenthooked += `\n\nAttachment: ${attachment.url}`;
            });

            // Include stickers in the mirrored message
            message.stickers.forEach(sticker => {
                mirroredContent += `\n\nSticker: ${sticker.url}`;
                mirroredContenthooked += `\n\nSticker: ${sticker.url}`;
            });

            // Try using webhooks
            let webhookClient = await getWebhook(targetChannel, message.author);
            if (webhookClient) {
                await webhookClient.send({
        content: mirroredContenthooked,
        username: `${message.author.username} [Via MariLink]`,
        avatarURL: message.author.displayAvatarURL({ format: 'png' }),});
            } else {
                await targetChannel.send(mirroredContent);
            }
        }
    }
});

async function getWebhook(channel, author) {
    try {
        const webhooks = await channel.fetchWebhooks();
        if (webhooks.size > 0) {
            return webhooks.first();
        } else {
            // Create a new webhook using the author's information
            const webhook = await channel.createWebhook({
                name: 'MariLink Webhook',
                avatar: 'https://i.imgur.com/7URmN7J.png',
            });
            return webhook;
        }
    } catch (error) {
        console.error('Error getting/creating webhook:', error);
        return null;
    }
}

client.login(token);
