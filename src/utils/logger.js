const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');

// Custom formatter to handle objects and multiple arguments for file logs
const format_message_for_file = winston.format.printf(({ timestamp, level, message, metadata }) =>
{
	let formatted_message = '';

	if (typeof message === 'object')
	{
		message = JSON.stringify(message, null, 2);  // Convert object to string for file logs
	}

	if (metadata && Object.keys(metadata).length > 0)
	{
		formatted_message += `${message} ${JSON.stringify(metadata, null, 2)}`;  // Append metadata if available
	}
	else
	{
		formatted_message = message;
	}

	return `${timestamp} [${level.toUpperCase()}]: ${formatted_message}`;  // Final formatted message for files
});

// Custom formatter to log objects directly to the console and handle multiple values
const format_message_for_console = winston.format.printf(({ timestamp, level, message, metadata }) =>
{
	let formatted_message = '';

	// If the message is an object or array of multiple arguments
	if (Array.isArray(message))
	{
		formatted_message = message.map(arg =>
		{
			if (typeof arg === 'object')
			{
				return JSON.stringify(arg, null, 2);  // Stringify object for the final message
			}
			return arg;  // Return string parts as is
		}).join(' ');
	}
	else if (typeof message === 'object')
	{
		formatted_message = JSON.stringify(message, null, 2);
	}
	else
	{
		formatted_message = message;
	}

	if (metadata && Object.keys(metadata).length > 0)
	{
		formatted_message += ` ${JSON.stringify(metadata, null, 2)}`;  // Append metadata in the log line
	}

	const final_message = `${timestamp} [${level.toUpperCase()}]: ${formatted_message}`;
	return winston.format.colorize().colorize(level, final_message);  // Colorize the entire line
});

// Create logger based on log type and log name
const create_logger = (log_type, log_name, debug_level = 'info') =>
{
	return winston.createLogger({
		level: debug_level,
		format: winston.format.combine(
			winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),  // Ensure timestamp is included
			winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] })  // Capture additional metadata (objects)
		),
		transports: [
			// Console transport with colorized full lines
			new winston.transports.Console({
				format: winston.format.combine(
					winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),  // Add timestamp for console
					format_message_for_console // Use custom formatter for console
				)
			}),
			// Daily rotated file transport without colorization
			new winston.transports.DailyRotateFile({
				filename: path.join(__dirname, '..', 'logs', `%DATE%-${log_name}.log`),
				datePattern: 'YYYY-MM-DD',  // Date pattern for logs
				zippedArchive: true,  // Compress old logs
				maxSize: '20m',  // Maximum size per log file
				maxFiles: '14d',  // Retain logs for 14 days
				format: winston.format.combine(
					winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),  // Add timestamp for file logs
					format_message_for_file // Use custom formatter for file logs
				)
			})
		]
	});
};

// Logger for bot's main operations
const bot_logger = create_logger('bot', 'b0t');

// Logger for server-specific events
const get_server_logger = (server_name, debug_level = 'info') =>
{
	return create_logger('server', server_name, debug_level);
};

// Logger for channel-specific events, including DMs and PMs
const get_channel_logger = (server_name, channel_name, debug_level = 'info') =>
{
	return create_logger('channel', `${server_name}-${channel_name}`, debug_level);
};

// Attach loggers to the global object
global.logger = bot_logger;
global.get_server_logger = get_server_logger;
global.get_channel_logger = get_channel_logger;

// Export the loggers
module.exports = {
	bot_logger,
	get_server_logger,
	get_channel_logger,
};
