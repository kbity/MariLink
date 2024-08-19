process.on('uncaughtException', function (exception) {
    console.log(exception);
});

const { fetch, setGlobalDispatcher, Agent } = require('undici');
setGlobalDispatcher(new Agent({ connect: { timeout: 60_000 } }));

const fs = require('fs');
const path = require('node:path');
const {
    Client,
    Intents,
    MessageEmbed,
    Collection,
    GatewayIntentBits,
    createWebhook,
    WebhookClient
} = require('discord.js');
const { token } = require('./config.json');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages, // Required to see messages
        GatewayIntentBits.MessageContent, // Required to read message content
        GatewayIntentBits.GuildMembers // Required to fetch all guild members
    ]
});

    let banList = [];
    try {
        const banListData = JSON.parse(fs.readFileSync('banlist.json'));
        banList = banListData.bannedUserIds || [];
    } catch (error) {
        console.error('Error reading banlist.json:', error);
    }

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
    // Reload the ban list
    let banList = [];
    try {
        const banListData = JSON.parse(fs.readFileSync('banlist.json'));
        banList = banListData.bannedUserIds || [];
    } catch (error) {
        console.error('Error reading banlist.json:', error);
    }

    if (banList.includes(message.author.id) || message.webhookId) {
        return;
    }

    let dbData = {};
    let messageData = {};
    try {
        dbData = JSON.parse(fs.readFileSync('db.json'));
    } catch (error) {
        console.error('Error reading db.json:', error);
    }

    try {
        messageData = JSON.parse(fs.readFileSync('messages.json'));
    } catch (error) {
        console.error('Error reading messages.json:', error);
    }

    let messageChannelId = message.channel.id;
    let messageChannelConfig = null;

    for (const channelConfig of Object.values(dbData)) {
        if (channelConfig.discordChannelIds && channelConfig.discordChannelIds.includes(messageChannelId)) {
            messageChannelConfig = channelConfig;
            break;
        }
    }

    if (!messageChannelConfig) {
        return;
    }

    // Check for local bans
    if (messageChannelConfig.banned && messageChannelConfig.banned.includes(message.author.id)) {
        return;
    }

    // Extract webhook manipulation commands
    let username = message.author.username + ' [Via MariLink]';
    let avatarURL = message.author.displayAvatarURL({ format: 'png' });
    let showMariLink = true;

    const commandRegex = /\\(avatar|name|showmarilink):(?:"([^"]+)"|([^ ]+))/g;
    let match;
    let commands = {};

    while ((match = commandRegex.exec(message.content)) !== null) {
        const [fullCommand, command, quotedValue, unquotedValue] = match;
        const value = quotedValue || unquotedValue;
        commands[command.toLowerCase()] = value;
    }

    // Remove commands from the message content
    let finalContent = message.content.replace(commandRegex, '').trim();

    // Verify user permissions
    const hasPermission = (userId) => {
        const isGlobalAdmin = dbData.globalAdmins && dbData.globalAdmins.includes(userId);
        const isChannelOwner = messageChannelConfig.userId === userId;
        const isLocalAdmin = messageChannelConfig.localAdmins && messageChannelConfig.localAdmins.includes(userId);
        const isLocalOperator = messageChannelConfig.localOperators && messageChannelConfig.localOperators.includes(userId);

        return isGlobalAdmin || isChannelOwner || isLocalAdmin || isLocalOperator;
    };

    if (hasPermission(message.author.id)) {
        if (commands.avatar) {
            avatarURL = commands.avatar;
        }
        if (commands.name) {
            username = commands.name;
        }
        if (commands.showmarilink === 'false') {
            showMariLink = false;
            username = username.replace(' [Via MariLink]', '');
        } else if (commands.showmarilink === 'true') {
            showMariLink = true;
            if (!username.includes('[Via MariLink]')) {
                username += ' [Via MariLink]';
            }
        }
    }

    let processedChannels = new Set(); // Track processed channels
    let targetChannelIds = messageChannelConfig.discordChannelIds.filter(channelId => channelId !== messageChannelId);

    for (const targetChannelId of targetChannelIds) {
        if (processedChannels.has(targetChannelId)) {
            continue; // Skip if already processed
        }
        processedChannels.add(targetChannelId);

        try {
            const targetChannel = await client.channels.fetch(targetChannelId);
            if (targetChannel) {
                let modifiedContent = finalContent;

                // Process attachments and stickers
                message.attachments.forEach(attachment => {
                    modifiedContent += `\n\nAttachment: <${attachment.url}>`;
                });

                message.stickers.forEach(sticker => {
                    modifiedContent += `\n\nSticker: <${sticker.url}>`;
                });

                // Clear and set up replyContent
                let replyContent = '';
                if (message.reference) {
                    const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
                    replyContent = `> __<:reply:1274886824652832788> Reply to `;
                    if (referencedMessage.webhookId) {
                        replyContent += `${referencedMessage.author.username}:__  `;
                    } else {
                        replyContent += `${referencedMessage.author}:__  `;
                    }
                    const contentLines = referencedMessage.content.split('\n');
                    let replyText = contentLines[0];
                    const urlRegex = /(https?:\/\/[^ ]+)/g;

                    // Carrot links inside the reply block
                    replyText = replyText.replace(urlRegex, '<$1>');

                    if (replyText.length > 256) {
                        replyText = replyText.substring(0, 256) + '...';
                    }
                    replyContent += replyText;
                    modifiedContent = `${replyContent}\n${modifiedContent}`;
                }

                // Avoid carrot links outside the reply block
                modifiedContent = modifiedContent.replace(/<(https?:\/\/[^ ]+)>/g, '$1');

                let webhookClient = await getWebhook(targetChannel, message.author);
                if (webhookClient) {
                    let sentMessage = await webhookClient.send({
                        content: modifiedContent,
                        username: username,
                        avatarURL: avatarURL,
                        allowedMentions: { parse: [] } // Prevent pings via webhooks
                    });
                    if (!messageData[message.id]) {
                        messageData[message.id] = {};
                    }
                    messageData[message.id][targetChannelId] = {
                        id: sentMessage.id,
                        webhookId: webhookClient.id,
                        webhookToken: webhookClient.token
                    };
                } else {
                    const sentMessage = await targetChannel.send({
                        content: `${message.author.username}: ${modifiedContent}`,
                        allowedMentions: { parse: [] } // Prevent pings via normal message
                    });
                    if (!messageData[message.id]) {
                        messageData[message.id] = {};
                    }
                    messageData[message.id][targetChannelId] = {
                        id: sentMessage.id,
                        webhookId: null,
                        webhookToken: null
                    };
                }
            }
        } catch (error) {
            console.error(`Error fetching or sending to channel ID ${targetChannelId}:`, error);
            continue;
        }
    }

    // Store the mirrored message IDs and author IDs in messages.json
    fs.writeFileSync('messages.json', JSON.stringify(messageData, null, 2));
});

client.on('messageUpdate', async (oldMessage, newMessage) => {
    let banList = [];
    try {
        const banListData = JSON.parse(fs.readFileSync('banlist.json'));
        banList = banListData.bannedUserIds || [];
    } catch (error) {
        console.error('Error reading banlist.json:', error);
    }

    if (banList.includes(newMessage.author.id) || newMessage.webhookId) {
        return;
    }

    let dbData = {};
    try {
        dbData = JSON.parse(fs.readFileSync('db.json'));
    } catch (error) {
        console.error('Error reading db.json:', error);
    }

    let messageChannelId = newMessage.channel.id;
    let messageChannelConfig = null;

    for (const channelConfig of Object.values(dbData)) {
        if (channelConfig.discordChannelIds && channelConfig.discordChannelIds.includes(messageChannelId)) {
            messageChannelConfig = channelConfig;
            break;
        }
    }

    if (!messageChannelConfig) {
        return;
    }

    if (messageChannelConfig.banned && messageChannelConfig.banned.includes(newMessage.author.id)) {
        return;
    }

    let messageData = {};
    try {
        messageData = JSON.parse(fs.readFileSync('messages.json'));
    } catch (error) {
        console.error('Error reading messages.json:', error);
        return;
    }

    if (!messageData[oldMessage.id]) {
        return;
    }

    const mirroredMessages = messageData[oldMessage.id];

    for (const targetChannelId of Object.keys(mirroredMessages)) {
        try {
            const targetChannel = await client.channels.fetch(targetChannelId);
            if (targetChannel) {
                const { id: mirroredMessageId, webhookId, webhookToken } = mirroredMessages[targetChannelId];

                let mirroredContenthooked = `${newMessage.content}`;
                newMessage.attachments.forEach(attachment => {
                    mirroredContenthooked += `\n\nAttachment: ${attachment.url}`;
                });

                if (newMessage.reference) {
                    const referencedMessage = await newMessage.channel.messages.fetch(newMessage.reference.messageId);
                    let replyContent = `> __<:reply:1274886824652832788> Reply to `;
                    if (referencedMessage.webhookId) {
                        replyContent += `${referencedMessage.author.username}:__  `;
                    } else {
                        replyContent += `${referencedMessage.author}:__  `;
                    }
                    const contentLines = referencedMessage.content.split('\n');
                    let replyText = contentLines[0];
                    const urlRegex = /(https?:\/\/[^ ]+)/g;
                    const urlMatch = replyText.match(urlRegex);
                    if (urlMatch) {
                        replyText = replyText.replace(urlRegex, (url) => {
                            if (url.length > 256) {
                                const mask = `sttp://${url.substring(url.indexOf('://') + 3, 256 - 3)}...`;
                                return `${mask}`;
                            } else {
                                return url;
                            }
                        });
                    }
                    if (replyText.length > 256) {
                        replyText = replyText.substring(0, 256) + '...';
                    }
                    replyContent += replyText;
                    mirroredContenthooked = `${replyContent}\n${mirroredContenthooked}`;
                }

                if (webhookId && webhookToken) {
                    const webhookClient = new WebhookClient({ id: webhookId, token: webhookToken });
                    await webhookClient.editMessage(mirroredMessageId, {
                        content: mirroredContenthooked
                    });
                } else {
                    const targetMessage = await targetChannel.messages.fetch(mirroredMessageId);
                    await targetMessage.edit({
                        content: mirroredContenthooked
                    });
                }
            }
        } catch (error) {
            console.error(`Error editing mirrored message in channel ID ${targetChannelId}:`, error);
        }
    }
});

client.on('messageDelete', async (message) => {
    let banList = [];
    try {
        const banListData = JSON.parse(fs.readFileSync('banlist.json'));
        banList = banListData.bannedUserIds || [];
    } catch (error) {
        console.error('Error reading banlist.json:', error);
    }

    if (banList.includes(message.author.id) || message.webhookId) {
        return;
    }

    let dbData = {};
    try {
        dbData = JSON.parse(fs.readFileSync('db.json'));
    } catch (error) {
        console.error('Error reading db.json:', error);
    }

    let messageChannelId = message.channel.id;
    let messageChannelConfig = null;

    for (const channelConfig of Object.values(dbData)) {
        if (channelConfig.discordChannelIds && channelConfig.discordChannelIds.includes(messageChannelId)) {
            messageChannelConfig = channelConfig;
            break;
        }
    }

    if (!messageChannelConfig) {
        return;
    }

    if (messageChannelConfig.banned && messageChannelConfig.banned.includes(message.author.id)) {
        return;
    }

    let messageData = {};
    try {
        messageData = JSON.parse(fs.readFileSync('messages.json'));
    } catch (error) {
        console.error('Error reading messages.json:', error);
        return;
    }

    if (!messageData[message.id]) {
        return;
    }

    const mirroredMessages = messageData[message.id];

    for (const targetChannelId of Object.keys(mirroredMessages)) {
        try {
            const targetChannel = await client.channels.fetch(targetChannelId);
            if (targetChannel) {
                const { id: mirroredMessageId, webhookId, webhookToken } = mirroredMessages[targetChannelId];

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
    }

    delete messageData[message.id];
    fs.writeFileSync('messages.json', JSON.stringify(messageData, null, 2));
});



async function getWebhook(channel, author) {
    try {
        const webhooks = await channel.fetchWebhooks();
        if (webhooks.size > 0) {
            return webhooks.first();
        } else {
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

