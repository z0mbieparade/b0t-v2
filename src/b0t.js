require('./utils/logger');

const fs = require('fs');
const path = require('path');
const setup_db = require('./db/db_setup');

// Server modules (discord, irc, etc.)
const DiscordBot = require('./servers/discord/discord_bot');
const IRCBot = require('./servers/irc/irc_bot');

// Path to the SQLite database file
const db_path = path.join(__dirname, 'db', 'b0t.db');

// Object to track the status of all servers
let server_status = {};

// Function to check if all servers have failed
const check_all_servers_failed = () => {
    const all_failed = Object.values(server_status).every(status => status === 'failed');
    if (all_failed) {
        global.logger.error('All servers have failed to connect. Shutting down the bot.');
        process.exit(1); // Shutdown the script if all servers fail
    }
};

// Function to initialize servers based on the config
const initialize_servers = (servers) => {
    global.logger.info("init servers:", servers);

    servers.forEach((server) => {
        server_status[server.server] = 'pending'; // Set the initial status as 'pending'

        switch (server.platform.toLowerCase()) {
            case 'discord':
                global.logger.info(`Starting Discord bot for ${server.server}...`);
                const discord_bot = new DiscordBot(server);

                // Handle success or failure
                discord_bot.on('connected', () => {
                    global.logger.info(`Discord bot connected successfully to ${server.server}.`);
                    server_status[server.server] = 'connected'; // Mark the server as connected
                });

                discord_bot.on('shutdown', () => {
                    global.logger.error(`Discord bot for ${server.server} failed to connect. Shutting down this instance.`);
                    server_status[server.server] = 'failed'; // Mark the server as failed
                    check_all_servers_failed(); // Check if all servers have failed
                });

                discord_bot.start();
                break;

            case 'irc':
                global.logger.info(`Starting IRC bot for ${server.server}...`);
                const irc_bot = new IRCBot(server);

                // Handle IRC bot success and shutdown
                irc_bot.on('connected', () => {
                    global.logger.info(`IRC bot connected successfully to ${server.server}.`);
                    server_status[server.server] = 'connected'; // Mark the server as connected
                });

                irc_bot.on('shutdown', () => {
                    global.logger.error(`IRC bot for ${server.server} failed to connect after retries. Shutting down this instance.`);
                    server_status[server.server] = 'failed'; // Mark the server as failed
                    check_all_servers_failed(); // Check if all servers have failed
                });

                irc_bot.connect();
                break;

            default:
                global.logger.error(`Unknown server platform: ${server.platform}`);
                server_status[server.server] = 'failed'; // Mark the server as failed
                check_all_servers_failed(); // Check if all servers have failed
        }
    });
};


// Main startup logic
const start_bot = () => {
    if (!fs.existsSync(db_path)) {
        global.logger.info('No DB found. Running initial DB setup...');
        
        setup_db((db_servers) => {
            // Once the database setup is complete, initialize servers
            global.logger.info("Database setup complete. Initializing servers...");
            initialize_servers(db_servers);
        });
    } else {
        global.logger.info('DB found. Loading data from database...');
        
        const sqlite3 = require('sqlite3').verbose();
        const db = new sqlite3.Database(db_path);

        // Fetch server configurations from the database
        db.all("SELECT * FROM servers", (err, rows) => {
            if (err) {
                global.logger.error("Error fetching server data from the database:", err.message);
                process.exit(1);
            } else if (rows.length === 0) {
                global.logger.error("No server configurations found in the database.");
                process.exit(1);
            } else {
                global.logger.info("Server configurations loaded. Initializing servers...");
                initialize_servers(rows);
            }
        });

        // Close the database connection after loading the data
        db.close((err) => {
            if (err) {
                global.logger.error('Error closing database:', err.message);
            } else {
                global.logger.info('Database connection closed.');
            }
        });
    }
};

// Start the bot
start_bot();
