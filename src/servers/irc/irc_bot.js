const get_logger = require('../../utils/logger');
const log = get_logger('b0t', __filename, 'purple');
const net = require('net');
const tls = require('tls');
const EventEmitter = require('events');

class IRCBot extends EventEmitter
{
	constructor (config)
	{
		super();

		this.config = {
			server: 'irc.freenode.com',
			port: 6667,
			ssl: false,
			nickname: 'b0t',
			username: 'b0t',
			realname: 'b0t',
			channels: ['#chat'],
			password: null,
			auto_reconnect: true,
			reconnect_delay: 5000,
			flood_protection: false,
			message_delay: 2000,
			max_retries: 3,  // New configuration option for maximum retries
			...config
		};

		this.message_queue = [];
		this.connected = false;
		this.socket = null;
		this.current_nick = this.config.nickname;
		this.retry_count = 0; // Initialize retry counter

		this.log = global.get_server_logger(this.config.server);
		this.log.debug(this.config);
	}

	// Establish connection to the server
	connect ()
	{
		if (this.retry_count >= this.config.max_retries)
		{
			log.error(`Failed to connect to ${this.config.server} after ${this.retry_count} attempts. Shutting down.`);
			this.emit('shutdown'); // Emit shutdown event for this specific server
			return;
		}

		const connectionOptions = {
			port: this.config.port,
			host: this.config.server,
			rejectUnauthorized: false // Use this to bypass certificate verification (development only)
		};

		const connection = this.config.ssl
			? tls.connect(connectionOptions, this.handle_connect.bind(this))
			: net.createConnection(connectionOptions, this.handle_connect.bind(this));

		// Socket event listeners
		connection.on('data', (data) => this.handle_data(data));
		connection.on('end', () => this.handle_disconnect());
		connection.on('error', (err) => this.handle_error(err));

		this.socket = connection;
	}

	// Handle successful connection
	handle_connect ()
	{
		this.log.info(`Connected to ${this.config.server}:${this.config.port}`);
		if (this.config.password)
		{
			this.send_command(`PASS ${this.config.password}`);
		}
		this.send_command(`NICK ${this.config.nickname}`);
		this.send_command(`USER ${this.config.username} 0 * :${this.config.realname}`);

		// Auto-join channels
		this.config.channels.forEach(channel => this.send_command(`JOIN ${channel}`));
		this.connected = true;
		this.retry_count = 0; // Reset retry counter on successful connection
		this.emit('connected');
	}

	// Handle incoming data
	handle_data (data)
	{
		const lines = data.toString().split('\r\n');
		lines.forEach(line =>
		{
			if (line)
			{
				this.log.info('Received:', line);

				if (line.startsWith('PING'))
				{
					const response = line.replace('PING', 'PONG');
					this.send_command(response);
				}

				const message_parts = line.split(' ');
				const command = message_parts[1];

				switch (command)
				{
					case 'PRIVMSG':
						const sender = this.extract_nick(message_parts[0]);
						const channel = message_parts[2];
						const message = message_parts.slice(3).join(' ').substring(1);
						this.emit('message', sender, channel, message);
						break;
					case 'JOIN':
						const nick = this.extract_nick(message_parts[0]);
						const join_channel = message_parts[2].substring(1);
						this.emit('join', nick, join_channel);
						break;
					case 'PART':
						const part_nick = this.extract_nick(message_parts[0]);
						const part_channel = message_parts[2];
						this.emit('part', part_nick, part_channel);
						break;
					case 'NICK':
						const old_nick = this.extract_nick(message_parts[0]);
						const new_nick = message_parts[2].substring(1);
						this.emit('nick', old_nick, new_nick);
						break;
					case 'QUIT':
						const quit_nick = this.extract_nick(message_parts[0]);
						this.emit('quit', quit_nick);
						break;
				}
			}
		});
	}

	// Handle disconnection
	handle_disconnect ()
	{
		this.log.info(`Disconnected from ${this.config.server}`);
		this.connected = false;
		if (this.config.auto_reconnect && this.retry_count < this.config.max_retries)
		{
			this.retry_count++; // Increment retry count on disconnect
			this.log.info(`Reconnecting in ${this.config.reconnect_delay}ms... Attempt ${this.retry_count}`);
			setTimeout(() => this.connect(), this.config.reconnect_delay);
		}
	}

	// Handle connection errors
	handle_error (err)
	{
		log.error(`IRC bot error on ${this.config.server}:`, err.message);
		this.retry_count++; // Increment retry count on error
		if (this.retry_count >= this.config.max_retries)
		{
			log.error(`Failed to connect after ${this.retry_count} attempts. Shutting down.`);
			this.emit('shutdown'); // Emit shutdown event for this specific server
			return;
		}
		if (this.config.auto_reconnect)
		{
			this.log.info(`Retrying in ${this.config.reconnect_delay}ms... Attempt ${this.retry_count}`);
			setTimeout(() => this.connect(), this.config.reconnect_delay);
		}
	}

	// Utility to extract nickname from message prefix
	extract_nick (prefix)
	{
		return prefix.split('!')[0].substring(1);
	}

	// Send raw command to IRC server
	send_command (command)
	{
		if (this.socket && this.connected)
		{
			this.message_queue.push(command);
			this.process_queue();
		}
		else
		{
			log.error('Cannot send command, not connected.');
		}
	}

	// Process queued messages with flood protection
	process_queue ()
	{
		if (this.message_queue.length > 0)
		{
			setTimeout(() =>
			{
				const command = this.message_queue.shift();
				this.socket.write(`${command}\r\n`);
				if (this.message_queue.length > 0)
				{
					this.process_queue();
				}
			}, this.config.message_delay);
		}
	}

	// Disconnect from server
	disconnect ()
	{
		if (this.socket && this.connected)
		{
			this.send_command('QUIT :Goodbye!');
			this.socket.end();
			this.connected = false;
		}
	}
}

module.exports = IRCBot;
