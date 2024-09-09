const fs = require('fs');
const path = require('path');
const db = require('../db');

const migrate_kinkshame = () =>
{
	return new Promise((resolve, reject) =>
	{
		const db_file_path = path.join(__dirname, '../../db/db.json');
		const json_data = JSON.parse(fs.readFileSync(db_file_path, 'utf8'));

		const kinkshame = json_data.kinkshame;

		if (!kinkshame)
		{
			return resolve();
		}

		db.serialize(() =>
		{
			kinkshame.forEach(shame =>
			{
				db.run(
					'INSERT INTO kinkshame (user, shame, shamed_by, when) VALUES (?, ?, ?, ?)',
					[shame.user, shame.shame, shame.shamed_by, shame.when],
					err =>
					{
						if (err) reject(err);
					}
				);
			});

			resolve();
		});
	});
};

module.exports = migrate_kinkshame;
