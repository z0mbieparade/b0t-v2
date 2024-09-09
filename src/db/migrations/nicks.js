const fs = require('fs');
const path = require('path');
const db = require('../db');
const {
	get_repo_base_path
} = require('../../utils/func');

const migrate_nicks = async (current_config) =>
{
	const repo_base_path = get_repo_base_path();
	const old_repo_path = current_config.old_repo_path || '../b0t';
	const old_db_path = path.join(repo_base_path, old_repo_path + '/db/');

	console.log({ current_config, old_db_path });

	try
	{
		const db_file_path = path.join(old_db_path, 'db.json');
		const json_data = JSON.parse(fs.readFileSync(db_file_path, 'utf8'));
		const nicks = json_data.nicks;

		if (!nicks)
		{
			return;
		}

		for (const nick_name of Object.keys(nicks))
		{
			const nick_data = nicks[nick_name];

			// Insert into nicks table
			const nick_id = await new Promise((resolve, reject) =>
			{
				db.run(
					'INSERT OR IGNORE INTO nicks (nick) VALUES (?)',
					[nick_name],
					function (err)
					{
						if (err) return reject(err);
						resolve(this.lastID);
					}
				);
			});

			// Insert tags into nick_tags table
			if (nick_data.tags)
			{
				for (const tag of nick_data.tags)
				{
					await new Promise((resolve, reject) =>
					{
						db.run(
							'INSERT INTO nick_tags (nick_id, tag) VALUES (?, ?)',
							[nick_id, tag],
							(err) =>
							{
								if (err) return reject(err);
								resolve();
							}
						);
					});
				}
			}

			// Insert seen data into nick_seen table
			if (nick_data.seen)
			{
				await new Promise((resolve, reject) =>
				{
					db.run(
						'INSERT INTO nick_seen (nick_id, date, chan, action, where_at) VALUES (?, ?, ?, ?, ?)',
						[nick_id, nick_data.seen.date, nick_data.seen.chan, nick_data.seen.action, nick_data.seen.where],
						(err) =>
						{
							if (err) return reject(err);
							resolve();
						}
					);
				});
			}

			// Insert spoke data into nick_spoken table
			if (nick_data.spoke && nick_data.spoke.text)
			{
				for (const spoke_item of nick_data.spoke.text)
				{
					await new Promise((resolve, reject) =>
					{
						db.run(
							'INSERT INTO nick_spoken (nick_id, date, text, words, letters, lines) VALUES (?, ?, ?, ?, ?, ?)',
							[nick_id, spoke_item.date, spoke_item.text, nick_data.spoke.words, nick_data.spoke.letters, nick_data.spoke.lines],
							(err) =>
							{
								if (err) return reject(err);
								resolve();
							}
						);
					});
				}
			}

			// Insert reminders into reminders table
			if (nick_data.reminders)
			{
				for (const reminder of nick_data.reminders)
				{
					await new Promise((resolve, reject) =>
					{
						db.run(
							'INSERT INTO reminders (nick_id, who, at_in, time, to_do, who_set, offset, timezone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
							[nick_id, reminder.who, reminder.at_in, reminder.time, reminder.to_do, reminder.who_set, reminder.offset, reminder.timezone],
							(err) =>
							{
								if (err) return reject(err);
								resolve();
							}
						);
					});
				}
			}
		}

		global.logger.info('Nicks migration completed successfully.');
	}
	catch (error)
	{
		global.logger.error('Error during nicks migration:', error);
		throw error;
	}
};

module.exports = migrate_nicks;
