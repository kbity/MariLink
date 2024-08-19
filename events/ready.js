const { Events } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(`Ready! Logged in as ${client.user.tag}`);

        // Initialize presence
        client.user.setPresence({ activities: [{ name: 'Initializing...' }], status: 'dnd' });

        // Store the interval ID
        let presenceInterval = setInterval(() => {
            client.user.setPresence({ activities: [{ name: 'MariLink v1.1.0' }], status: 'online' });
        }, 1000);

        // Clear the interval when necessary (for example, when the bot is shutting down)
        // You should have a way to clear this interval when it's no longer needed
        // For example:
        // process.on('SIGINT', () => {
        //     clearInterval(presenceInterval);
        //     process.exit(0);
        // });
    },
};

