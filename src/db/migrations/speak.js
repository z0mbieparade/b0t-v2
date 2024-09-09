const fs = require('fs');
const path = require('path');
const db = require('../db');

const migrate_speak = () =>
{
	return new Promise((resolve, reject) =>
	{
		const db_file_path = path.join(__dirname, '../../db/db.json');
		const json_data = JSON.parse(fs.readFileSync(db_file_path, 'utf8'));

		const speak = json_data.speak;

		if (!speak)
		{
			return resolve();
		}

		db.serialize(() =>
		{
			Object.keys(speak).forEach(server =>
			{
				Object.keys(speak[server]).forEach(channel =>
				{
					speak[server][channel].forEach(timestamp =>
					{
						db.run(
							'INSERT INTO speak (server_id, channel_id, timestamp) VALUES (?, ?, ?)',
							[server, channel, timestamp],
							err =>
							{
								if (err) reject(err);
							}
						);
					});
				});
			});

			resolve();
		});
	});
};

module.exports = migrate_speak;
