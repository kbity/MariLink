const { SlashCommandBuilder } = require('discord.js');

const CURRENT_VERSION = 'v1.2.1';
const REPO_URL = 'https://api.github.com/repos/kbity/MariLink/releases/latest';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ver')
        .setDescription('Gets MariLink Version'),
    async execute(interaction) {
        try {
            // Dynamically import node-fetch
            const fetch = await import('node-fetch').then(mod => mod.default);

            const response = await fetch(REPO_URL);
            if (!response.ok) {
                throw new Error(`GitHub API request failed: ${response.statusText}`);
            }

            const latestRelease = await response.json();
            const latestVersion = latestRelease.tag_name; // Assume tag_name follows the format "bird231"

            const currentVersionNumber = CURRENT_VERSION.match(/\d+/g).join('');
            const latestVersionNumber = latestVersion.match(/\d+/g).join('');

            let title, description, color;

            if (currentVersionNumber === latestVersionNumber) {
                title = `MariLink ${CURRENT_VERSION}`;
                description = 'This instance is up to date!';
                color = 0x00FF00; // GREEN
            } else if (currentVersionNumber < latestVersionNumber) {
                title = `MariLink ${CURRENT_VERSION}`;
                description = `This instance is outdated!\nThe latest version is ${latestRelease.name}.\nCheck for updates: https://github.com/kbity/MariLink`;
                color = 0xFF0000; // RED
            } else {
                // Current version is ahead of the official repo
                const botId = interaction.client.user.id;
                if (botId === '1118256931040149626') {
                    description = "Mari hasn't updated the repo or This version isnt released yet.";
                } else {
                    description = "This bot might be using a preview version of MariLink, or it might be a fork.";
                }
                title = `MariLink ${CURRENT_VERSION}`;
                color = 0xFFFF00; // YELLOW
            }

            const embed = {
                title,
                description,
                color,
            };

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error fetching latest version:', error);
            await interaction.reply({ content: 'Failed to check the latest version.', ephemeral: true });
        }
    },
};
