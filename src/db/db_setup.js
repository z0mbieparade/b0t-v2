/*
This script runs on b0t.js startup if no db.sql file is found.

1. Runs db.js which creates the empty database if it doesn't exist.
2. Ask user a bunch of questions so we can insert server/channel data into the db.
3. Ask if user wants to migrate old v1 b0t data. If true, get b0t v1 path. (should be in the same root folder as this repo)
4. If user says YES to migration, we access b0t/db/*.json files and go table by table to import data.
5. Servers/channels may not match old data, so if linking is required we need to pause mid-table import to prompt user for more data.

*/
const path = require('path');
const setup_config = require('../utils/qa');
const questions_path = path.join(__dirname, 'db_questions.json');
const {
	migrate_nicks,
	migrate_bugs_requests,
	migrate_speak,
	migrate_reminders,
	migrate_kinkshame,
	migrate_infobot,
	migrate_topics,
	migrate_polls,
	migrate_creeds,
	migrate_all_tables
} = require('./migrations');

// Handle the migrations directly inside after_question_callbacks
const after_question_callbacks = {
	migrate_all: async (answer, current_config) =>
	{
		if (answer)
		{
			global.logger.info('Starting migration for all tables...');
			try
			{
				await migrate_all_tables(current_config);
				global.logger.info('All migrations completed successfully.');
			}
			catch (err)
			{
				global.logger.error('Error during migration:', err);
			}
		}
		else
		{
			return Promise.resolve();
		}
	},
	migrate_nicks: async (answer, current_config) =>
	{
		if (answer)
		{
			try
			{
				await migrate_nicks(current_config);
				global.logger.info('Nicks migration completed successfully.');
			}
			catch (err)
			{
				global.logger.error('Error during nicks migration:', err);
			}
		}
		else
		{
			return Promise.resolve();
		}
	},
	migrate_bugs_requests: async (answer, current_config) =>
	{
		if (answer)
		{
			try
			{
				await migrate_bugs_requests(current_config);
				global.logger.info('Bugs and requests migration completed successfully.');
			}
			catch (err)
			{
				global.logger.error('Error during bugs/requests migration:', err);
			}
		}
		else
		{
			return Promise.resolve();
		}
	},
	// Similarly for other migrations
	migrate_speak: async (answer, current_config) =>
	{
		if (answer)
		{
			await migrate_speak(current_config);
		}
	},
	migrate_reminders: async (answer, current_config) =>
	{
		if (answer)
		{
			await migrate_reminders(current_config);
		}
	},
	migrate_kinkshame: async (answer, current_config) =>
	{
		if (answer)
		{
			await migrate_kinkshame(current_config);
		}
	},
	migrate_infobot: async (answer, current_config) =>
	{
		if (answer)
		{
			await migrate_infobot(current_config);
		}
	},
	migrate_topics: async (answer, current_config) =>
	{
		if (answer)
		{
			await migrate_topics(current_config);
		}
	},
	migrate_polls: async (answer, current_config) =>
	{
		if (answer)
		{
			await migrate_polls(current_config);
		}
	},
	migrate_creeds: async (answer, current_config) =>
	{
		if (answer)
		{
			await migrate_creeds(current_config);
		}
	}
};

const setup_done_callback = () =>
{
	global.logger.debug('Setup Complete!');
};

// Main database setup function with async/await
const setup_db = async () =>
{
	try
	{
		const final_config = await setup_config(questions_path, after_question_callbacks, setup_done_callback);
		global.logger.debug('Config:', final_config);
	}
	catch (err)
	{
		global.logger.error('Error during setup:', err);
	}
};

module.exports = setup_db;
