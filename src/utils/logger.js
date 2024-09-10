const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');
const { colorize_string } = require('./color');

const colorize_by_level = (level, str) =>
{
	let color = 'green';
	switch(level)
	{
		case 'debug':
			color = 'blue';
			break;
		case 'warn':
			color = 'orange';
			break;
		case 'error':
			color = 'red';
			break;
		default:
			color = 'green';
			break;
	}

	return colorize_string(str, color);
};

// Check if a string is a valid filename
const is_valid_filename = (str) =>
{
	if(!str || str === undefined || str === null) return false;
	const filename_regex = /^.+\.[A-Za-z]{2,4}$/;
	return filename_regex.test(str);
};

// Custom formatter to handle objects and multiple arguments for file logs
const format_message_for_file = (filename_color) => winston.format.printf(({ timestamp, level, message, metadata, filename }) =>
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
const format_message_for_console = (filename_color) => winston.format.printf(({ timestamp, level, message, metadata, filename }) =>
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
	const colored_filename = filename_part ? colorize_string(filename_part, filename_color) : '';

	return colorize_by_level(level, `${timestamp} [${level.toUpperCase()}]`) + colored_filename + colorize_by_level(level, `: ${formatted_message}`);
});

// Create logger based on log type and log name
const create_logger = (log_name, filename_color = 'white', debug_level = 'debug') =>
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
					format_message_for_console(filename_color) // Use custom formatter for console
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
					format_message_for_file(filename_color) // Use custom formatter for file logs
				)
			})
		]
	});
};

const get_logger = (log_name, filename, filename_color = 'white', debug_level = 'debug') =>
{
	const logger = create_logger(log_name, filename_color, debug_level);

	['info', 'debug', 'error', 'warn'].forEach((level) =>
	{
		const original_log_method = logger[level];
		logger[level] = (...args) =>
		{
			const message = args.length > 1 ? args : args[0];
			original_log_method({
				level,
				message,
				filename
			});
		};
	});

	return logger;
};

// Export the loggers
module.exports = get_logger;
