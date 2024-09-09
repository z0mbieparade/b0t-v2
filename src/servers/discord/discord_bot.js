const { Client, GatewayIntentBits } = require('discord.js');

class DiscordBot
{
	constructor (config)
	{
		this.token = config.token;  // Discord bot token from the config file
		this.prefix = config.prefix || '!';  // Command prefix
		this.client = new Client({
			intents: [
				GatewayIntentBits.Guilds,
				GatewayIntentBits.GuildMessages,
				GatewayIntentBits.MessageContent,
				GatewayIntentBits.GuildMembers
			]
		});

		// Event listeners
		this.client.on('ready', () => this.onReady());
		this.client.on('messageCreate', (message) => this.onMessage(message));
		this.client.on('guildCreate', (guild) => this.onGuildJoin(guild));
	}

	// Called when the bot is ready
	onReady ()
	{
		global.logger.info(`Logged in as ${this.client.user.tag}!`);
	}

	// Called when a new message is created
	onMessage (message)
	{
		// Ignore bot messages
		if (message.author.bot) return;

		// Check if the message starts with the bot's prefix
		if (message.content.startsWith(this.prefix))
		{
			const [command, ...args] = message.content.slice(this.prefix.length).trim().split(/\s+/);

			// Example: simple ping command
			if (command === 'ping')
			{
				message.channel.send('Pong!');
			}

			// Other commands can be added here
		}
	}

	// Called when the bot joins a new guild (server)
	onGuildJoin (guild)
	{
		global.logger.info(`Joined new server: ${guild.name}`);
	}

	// Start the bot
	start ()
	{
		// Login to Discord with the token
		this.client.login(this.token).catch(err =>
		{
			global.logger.error('Failed to login to Discord:', err);
		});
	}
}

module.exports = DiscordBot;
