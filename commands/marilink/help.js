const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('help')
		.setDescription('dear fucking god i dont understand marilink at all'),
	async execute(interaction) {
		const helpEmbed = new EmbedBuilder()
			.setColor(0xe342fd)
			.setTitle('Command Help')
			.addFields(
				{ name: '/link', value: 'The most important MariLink command. "name" is the channel name, either one from the channel browser, "general" (which is probably what you want), or a name of a channel you or someone else made for private use. "channel" is where you put the channel in your discord server to link to. "password" is an optional field used if a channel has a password set up to prevent unauthorized links for private channels. requires manage server or admin.', inline: false },
				{ name: '/unlink', value: '/link but backwards. put in the name of the MariLink channel, and the channel in your server to remove the link.', inline: false },
				{ name: '/createchannel', value: 'creates a channel for MariLink. "name" is the name the channel will use, "password", as mentioned in /link, is for preventing unauthorized links. "publicallylisted", if set to yes, will allow your channel to be seen in the channel browser. not recommended if you set a password.', inline: false },
				{ name: '/deletechannel', value: 'removed a channel from MariLink. "name" is the name the channel will delete. you must be channel owner to delete a channel. confirmation is required.', inline: false },
				{ name: '/delete', value: 'attempts to delete a message across all the channels. it doesnt correctly work iirc', inline: false },
				{ name: '/ban', value: 'bans a user from either a specific channel, or (if you have global admin), the whole of MariLink', inline: false },
				{ name: '/unban', value: 'do i need to explain this? it unbans a user', inline: false },
				{ name: '/promote', value: 'gives a user perms to either a channel you own, or the entirety of MariLink. currently, this is irreversable without access to editing the database. if you need to demote someone, ask me.', inline: false },
				{ name: '/browser', value: 'shows you public marilink channels. also has a search option.', inline: false },
				{ name: '/ver', value: 'gets marilink version', inline: false }
			)
		await interaction.reply({ embeds: [helpEmbed] });
	},
};

