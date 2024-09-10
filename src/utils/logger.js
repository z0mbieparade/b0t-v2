const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');

// Function to check if a string is a valid filename
const is_valid_filename = (str) =>
{
	if(!str || str === undefined || str === null) return false;

	const filename = path.basename(str);
	const filename_regex = /^[\w,\s-]+\.[A-Za-z]{2,4}$/;
	return filename_regex.test(filename);
};

// Custom formatter to handle objects and multiple arguments for file logs
const format_message_for_file = winston.format.printf(({ timestamp, level, message, metadata, filename }) =>
{
	let formatted_message = '';

	if (Array.isArray(message))
	{
		// If the message is an array, combine the parts into a single message
		formatted_message = message.map(part => (typeof part === 'object' ? JSON.stringify(part, null, 2) : part)).join(' ');
	}
	else if (typeof message === 'object')
	{
		message = JSON.stringify(message, null, 2);  // Convert object to string for file logs
	}

	if (metadata && Object.keys(metadata).length > 0)
	{
		formatted_message += ` ${JSON.stringify(metadata, null, 2)}`;  // Append metadata if available
	}

	// If filename is valid, include it; otherwise, treat as a normal message
	const filename_part = is_valid_filename(filename) ? `[${path.basename(filename)}]` : '';
	return `${timestamp} [${level.toUpperCase()}]${filename_part}: ${formatted_message || message}`;  // Final formatted message for files
});

// Custom formatter to log objects directly to the console and handle multiple values
const format_message_for_console = winston.format.printf(({ timestamp, level, message, metadata, filename }) =>
{
	let formatted_message = '';

	// If the message is an array, combine it into a single message
	if (Array.isArray(message))
	{
		formatted_message = message.map(part => (typeof part === 'object' ? JSON.stringify(part, null, 2) : part)).join(' ');
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

	// If filename is valid, include it; otherwise, treat as a normal message
	const filename_part = is_valid_filename(filename) ? `[${path.basename(filename)}]` : '';
	const final_message = `${timestamp} [${level.toUpperCase()}]${filename_part}: ${formatted_message}`;
	return winston.format.colorize().colorize(level, final_message);  // Colorize the entire line
});

// Create logger based on log type and log name
const create_logger = (log_type, log_name, debug_level = 'debug') =>
{
	return winston.createLogger({
		level: debug_level,
		format: winston.format.combine(
			winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),  // Ensure timestamp is included
			winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'filename'] })  // Capture additional metadata (objects)
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
const get_server_logger = (server_name, debug_level = 'debug') =>
{
	return create_logger('server', server_name, debug_level);
};

// Logger for channel-specific events, including DMs and PMs
const get_channel_logger = (server_name, channel_name, debug_level = 'debug') =>
{
	return create_logger('channel', `${server_name}-${channel_name}`, debug_level);
};

// Function to set logging methods dynamically on global.logger
const set_global_logger_methods = (logger) =>
{
	['info', 'debug', 'error', 'warn'].forEach((level) =>
	{
		global.logger[level] = (...args) =>
		{
			const last_argument = args.pop();
			const filename = is_valid_filename(last_argument) ? last_argument : null;
			const message = filename ? args : [...args, last_argument];

			logger.log({
				level,
				message,
				filename
			});
		};
	});
};

global.logger = bot_logger;
set_global_logger_methods(global.logger);

global.get_server_logger = get_server_logger;
global.get_channel_logger = get_channel_logger;

// Export the loggers
module.exports = {
	bot_logger,
	get_server_logger,
	get_channel_logger,
};
