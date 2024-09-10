require('./utils/logger');

const fs = require('fs');
const path = require('path');
const db = require('./db/db');

// Server modules (discord, irc, etc.)
const DiscordBot = require('./servers/discord/discord_bot');
const IRCBot = require('./servers/irc/irc_bot');

// Object to track the status of all servers
const server_status = {};

// Function to check if all servers have failed
const check_all_servers_failed = () =>
{
	const all_failed = Object.values(server_status).every(status => status === 'failed');
	if (all_failed)
	{
		global.logger.error('All servers have failed to connect. Shutting down the bot.', __filename);
		process.exit(1); // Shutdown the script if all servers fail
	}
};

// Function to initialize servers based on the config
const initialize_servers = (servers) =>
{
	global.logger.info('init servers:', servers, __filename);

	servers.forEach((server) =>
	{
		global.logger.info('Starting server...', server, __filename);
		server_status[server.server] = 'pending'; // Set the initial status as 'pending'

		switch (server.type.toLowerCase())
		{
			case 'discord':
				global.logger.info(`Starting Discord bot for ${server.server}...`, __filename);
				const discord_bot = new DiscordBot(server);

				// Handle success or failure
				discord_bot.on('connected', () =>
				{
					global.logger.info(`Discord bot connected successfully to ${server.server}.`, __filename);
					server_status[server.server] = 'connected'; // Mark the server as connected
				});

				discord_bot.on('shutdown', () =>
				{
					global.logger.error(`Discord bot for ${server.server} failed to connect. Shutting down this instance.`, __filename);
					server_status[server.server] = 'failed'; // Mark the server as failed
					check_all_servers_failed(); // Check if all servers have failed
				});

				discord_bot.start();
				break;

			case 'irc':
				global.logger.info(`Starting IRC bot for ${server.server}...`, __filename);
				const irc_bot = new IRCBot(server);

				// Handle IRC bot success and shutdown
				irc_bot.on('connected', () =>
				{
					global.logger.info(`IRC bot connected successfully to ${server.server}.`, __filename);
					server_status[server.server] = 'connected'; // Mark the server as connected
				});

				irc_bot.on('shutdown', () =>
				{
					global.logger.error(`IRC bot for ${server.server} failed to connect after retries. Shutting down this instance.`, __filename);
					server_status[server.server] = 'failed'; // Mark the server as failed
					check_all_servers_failed(); // Check if all servers have failed
				});

				irc_bot.connect();
				break;

			default:
				global.logger.error(`Unknown server platform: ${server.platform}`, __filename);
				server_status[server.server] = 'failed'; // Mark the server as failed
				check_all_servers_failed(); // Check if all servers have failed
		}
	});
};

let config;

(async () =>
{
	// try
	// {
	await db.initialize_db();

	if (db.db_created)
	{
		global.logger.info('New database created. Running db_setup.js for additional setup...', __filename);
		const setup_db = require('./db/db_setup');
		config = await setup_db();
	}
	else
	{
		global.logger.info('Database found.', __filename);
	}

	let servers = await db.get_all_rows('SELECT * FROM servers');

	if (!servers || servers.length === 0)
	{
		global.logger.info('No servers found in the database. Running db_setup.js for configuration...', __filename);
		const setup_db = require('./db/db_setup');
		config = await setup_db();  // Run setup if no servers exist
		servers = await db.get_all_rows('SELECT * FROM servers');
	}
	else
	{
		global.logger.info('Servers found in the database. Initializing servers...', __filename);
		await initialize_servers(servers);  // Proceed with initializing the servers
	}

	if (servers && servers.length > 0)
	{
		initialize_servers(servers);
	}
	else
	{
		global.logger.error('Something went wrong. No servers found:', { config, servers }, __filename);
	}
	// }
	// catch (err)
	// {
	// 	global.logger.error('Error during database initialization:', err, __filename);
	// }

	db.close_db((err) =>
	{
		if (err)
		{
			global.logger.error('Error closing database:', err.message, __filename);
		}
		else
		{
			global.logger.info('Database connection closed.', __filename);
		}
	});
})();
