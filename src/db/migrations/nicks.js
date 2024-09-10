const get_logger = require('../../utils/logger');
const log = get_logger('b0t', __filename);
const fs = require('fs');
const path = require('path');
const db = require('../db');
const {
	get_repo_base_path
} = require('../../utils/func');

const migrate_nicks = async (current_config) =>
{
	const table_name = 'nicks';
	const repo_base_path = get_repo_base_path();
	const old_repo_path = current_config.old_repo_path || '../b0t';
	const old_db_path = path.join(repo_base_path, old_repo_path + '/db/');

	console.log({ table_name, current_config, old_db_path });

	try
	{
		const db_file_path = path.join(old_db_path, 'db.json');
		const json_data = JSON.parse(fs.readFileSync(db_file_path, 'utf8'));
		const nicks = json_data.nicks;

		if (!nicks)
		{
			log.info('No ' + table_name + ' to migrate.');
			return;
		}

		console.log({ nicks });

		for (const nick_name in nicks)
		{
			const nick_data = nicks[nick_name];

			// Insert into nicks table using run_query
			const nick_id = await run_query('INSERT OR IGNORE INTO nicks (nick) VALUES (?)', [nick_name]);

			if (nick_data.tags)
			{
				for (const tag of nick_data.tags)
				{
					await run_query('INSERT INTO nick_tags (nick_id, tag) VALUES (?, ?)', [nick_id, tag]);
				}
			}

			if (nick_data.seen)
			{
				await run_query('INSERT INTO nick_seen (nick_id, date, chan, action, where_at) VALUES (?, ?, ?, ?, ?)',
					[nick_id, nick_data.seen.date, nick_data.seen.chan, nick_data.seen.action, nick_data.seen.where]);
			}

			if (nick_data.spoke && nick_data.spoke.text)
			{
				for (const spoke_item of nick_data.spoke.text)
				{
					await run_query('INSERT INTO nick_spoken (nick_id, date, text, words, letters, lines) VALUES (?, ?, ?, ?, ?, ?)',
						[nick_id, spoke_item.date, spoke_item.text, nick_data.spoke.words, nick_data.spoke.letters, nick_data.spoke.lines]);
				}
			}

			if (nick_data.reminders)
			{
				for (const reminder of nick_data.reminders)
				{
					await run_query('INSERT INTO reminders (nick_id, who, at_in, time, to_do, who_set, offset, timezone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
						[nick_id, reminder.who, reminder.at_in, reminder.time, reminder.to_do, reminder.who_set, reminder.offset, reminder.timezone]);
				}
			}

			// Insert remaining fields into nick_data table
			const misc_data = {
				lastfm: nick_data.lastfm,
				untappd: nick_data.untappd,
				trakt: nick_data.trakt,
				goodreads: nick_data.goodreads,
				offset: nick_data.offset,
				display_location: nick_data.display_location,
				lat: nick_data.lat,
				long: nick_data.long,
				timezone: nick_data.timezone,
			};

			for (const [key, value] of Object.entries(misc_data))
			{
				if (value !== undefined)
				{
					await run_query('INSERT INTO nick_data (nick_id, key, value) VALUES (?, ?, ?)', [nick_id, key, value]);
				}
			}
		}

		log.info(table_name + ' migration completed successfully.');
	}
	catch (error)
	{
		log.error('Error during ' + table_name + ' migration:', error);
		throw error;
	}
};

module.exports = migrate_nicks;
