const get_logger = require('./utils/logger');
const log = get_logger('b0t', __filename, 'red');
const db = require('./db/db');

//if we call --setup on start, it runs the setup script even if we've already got a db/servers
const args = process.argv.slice(2);
const force_setup = args.includes('--setup');

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
		log.error('All servers have failed to connect. Shutting down the bot.');
		process.exit(1); // Shutdown the script if all servers fail
	}
};

// Function to initialize servers based on the config
const initialize_servers = (servers) =>
{
	log.info('init servers:', servers);

	servers.forEach((server) =>
	{
		log.info('Starting server...', server);
		server_status[server.server] = 'pending'; // Set the initial status as 'pending'

		switch (server.type.toLowerCase())
		{
			case 'discord':
				log.info(`Starting Discord bot for ${server.server}...`);
				const discord_bot = new DiscordBot(server);

				// Handle success or failure
				discord_bot.on('connected', () =>
				{
					log.info(`Discord bot connected successfully to ${server.server}.`);
					server_status[server.server] = 'connected'; // Mark the server as connected
				});

				discord_bot.on('shutdown', () =>
				{
					log.error(`Discord bot for ${server.server} failed to connect. Shutting down this instance.`);
					server_status[server.server] = 'failed'; // Mark the server as failed
					check_all_servers_failed(); // Check if all servers have failed
				});

				discord_bot.start();
				break;

			case 'irc':
				log.info(`Starting IRC bot for ${server.server}...`);
				const irc_bot = new IRCBot(server);

				// Handle IRC bot success and shutdown
				irc_bot.on('connected', () =>
				{
					log.info(`IRC bot connected successfully to ${server.server}.`);
					server_status[server.server] = 'connected'; // Mark the server as connected
				});

				irc_bot.on('shutdown', () =>
				{
					log.error(`IRC bot for ${server.server} failed to connect after retries. Shutting down this instance.`);
					server_status[server.server] = 'failed'; // Mark the server as failed
					check_all_servers_failed(); // Check if all servers have failed
				});

				irc_bot.connect();
				break;

			default:
				log.error(`Unknown server platform: ${server.platform}`);
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

	if (db.db_created || force_setup === true)
	{
		log.info('Running db_setup.js for additional setup...');
		const setup_db = require('./db/db_setup');
		config = await setup_db();
	}
	else
	{
		log.info('Database found.');
	}

	let servers = await db.get_all_rows('SELECT * FROM servers');

	if (!servers || servers.length === 0)
	{
		log.info('No servers found in the database. Running db_setup.js for configuration...');
		const setup_db = require('./db/db_setup');
		config = await setup_db();  // Run setup if no servers exist
		servers = await db.get_all_rows('SELECT * FROM servers');
	}
	else
	{
		log.info('Servers found in the database. Initializing servers...');
		await initialize_servers(servers);  // Proceed with initializing the servers
	}

	if (servers && servers.length > 0)
	{
		initialize_servers(servers);
	}
	else
	{
		log.error('Something went wrong. No servers found:', { config, servers });
	}
	// }
	// catch (err)
	// {
	// 	log.error('Error during database initialization:', err);
	// }

	db.close_db((err) =>
	{
		if (err)
		{
			log.error('Error closing database:', err.message);
		}
		else
		{
			log.info('Database connection closed.');
		}
	});
})();
