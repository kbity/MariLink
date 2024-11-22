const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('browser')
		.setDescription('Explore channels in marilink')
		.addStringOption(option => 
			option.setName('search')
				.setDescription('Search for a specific public channel by name.')
		),
	async execute(interaction) {
		const searchQuery = interaction.options.getString('search');
		const filePath = path.resolve(__dirname, '../../db.json');

		// Load and parse db.json
		let channels;
		try {
			const data = fs.readFileSync(filePath, 'utf8');
			channels = JSON.parse(data);
		} catch (error) {
			console.error('Error reading db.json:', error);
			return interaction.reply({ content: 'Error loading channels.', ephemeral: true });
		}

		// Filter for public channels
		let publicChannels = Object.entries(channels)
			.filter(([_, details]) => details.isPublic === 1)
			.map(([name, details]) => ({ name, ...details }));

		// If search query is provided, filter based on it
		if (searchQuery) {
			publicChannels = publicChannels.filter(channel => 
				channel.name.toLowerCase().includes(searchQuery.toLowerCase())
			);
		}

		// Check if no channels found
		if (publicChannels.length === 0) {
			return interaction.reply({ content: 'No public channels found.', ephemeral: true });
		}

		// Paginate channels (10 per page)
		const embeds = [];
		for (let i = 0; i < publicChannels.length; i += 10) {
			const currentPage = publicChannels.slice(i, i + 10);
			const embed = new EmbedBuilder()
				.setColor(0xe342fd)
				.setTitle('Public Channels')
				.setDescription('List of public channels available on MariLink.');

			currentPage.forEach(channel => {
				embed.addFields({ name: channel.name, value: `by <@${channel.userId}>`, inline: false });
			});

			embed.setFooter({ text: `Page ${Math.floor(i / 10) + 1} of ${Math.ceil(publicChannels.length / 10)}` });
			embeds.push(embed);
		}

		let currentPageIndex = 0;

		// Button components for navigation
		const buttonRow = new ActionRowBuilder()
			.addComponents(
				new ButtonBuilder()
					.setCustomId('previous')
					.setLabel('Previous')
					.setStyle(ButtonStyle.Primary)
					.setDisabled(true), // Disabled at start as we're on the first page
				new ButtonBuilder()
					.setCustomId('next')
					.setLabel('Next')
					.setStyle(ButtonStyle.Primary)
					.setDisabled(embeds.length === 1) // Disabled if only one page
			);

		// Send the initial embed with buttons
		const message = await interaction.reply({ 
			embeds: [embeds[currentPageIndex]], 
			components: [buttonRow], 
			fetchReply: true 
		});

		// Button interaction collector
		const collector = message.createMessageComponentCollector({ time: 60000 });

		collector.on('collect', async (buttonInteraction) => {
			if (buttonInteraction.user.id !== interaction.user.id) return buttonInteraction.reply({ content: 'These buttons are not for you!', ephemeral: true });

			if (buttonInteraction.customId === 'next') {
				currentPageIndex++;
			} else if (buttonInteraction.customId === 'previous') {
				currentPageIndex--;
			}

			// Update the buttons' disabled state based on current page index
			buttonRow.components[0].setDisabled(currentPageIndex === 0);
			buttonRow.components[1].setDisabled(currentPageIndex === embeds.length - 1);

			await buttonInteraction.update({ 
				embeds: [embeds[currentPageIndex]], 
				components: [buttonRow] 
			});
		});

		collector.on('end', () => {
			buttonRow.components.forEach(button => button.setDisabled(true));
			message.edit({ components: [buttonRow] });
		});
	},
};
