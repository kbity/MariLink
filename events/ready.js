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
            client.user.setPresence({ activities: [{ name: 'MariLink v1.2.0' }], status: 'online' });
        }, 1000);
    },
};

