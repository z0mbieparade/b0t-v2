const fs = require('fs');
const path = require('path');
const db = require('../db');

const migrate_reminders = () =>
{
	return new Promise((resolve, reject) =>
	{
		const db_file_path = path.join(__dirname, '../../db/db.json');
		const json_data = JSON.parse(fs.readFileSync(db_file_path, 'utf8'));

		const nicks = json_data.nicks;

		if (!nicks)
		{
			return resolve();
		}

		db.serialize(() =>
		{
			Object.keys(nicks).forEach(nick_name =>
			{
				const nick_data = nicks[nick_name];

				// Check if reminders exist for this nick
				if (nick_data.reminders)
				{
					nick_data.reminders.forEach(reminder =>
					{
						db.run(
							'INSERT INTO reminders (who, at_in, time, to_do, who_set, offset, timezone) VALUES (?, ?, ?, ?, ?, ?, ?)',
							[reminder.who, reminder.at_in, reminder.time, reminder.to_do, reminder.who_set, reminder.offset, reminder.timezone],
							err =>
							{
								if (err) reject(err);
							}
						);
					});
				}
			});

			resolve();
		});
	});
};

module.exports = migrate_reminders;
