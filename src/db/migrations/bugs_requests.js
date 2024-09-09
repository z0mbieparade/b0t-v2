const fs = require('fs');
const path = require('path');
const db = require('../db');

const migrate_bugs_requests = () =>
{
	return new Promise((resolve, reject) =>
	{
		const db_file_path = path.join(__dirname, '../../db/db.json');
		const json_data = JSON.parse(fs.readFileSync(db_file_path, 'utf8'));

		const bugs = json_data.bugs;
		const requests = json_data.requests;

		db.serialize(() =>
		{
			if (bugs && bugs.length)
			{
				bugs.forEach(bug =>
				{
					db.run(
						'INSERT INTO bugs (description) VALUES (?)',
						[bug],
						err =>
						{
							if (err) reject(err);
						}
					);
				});
			}

			if (requests && requests.length)
			{
				requests.forEach(request =>
				{
					db.run(
						'INSERT INTO requests (description) VALUES (?)',
						[request],
						err =>
						{
							if (err) reject(err);
						}
					);
				});
			}

			resolve();
		});
	});
};

module.exports = migrate_bugs_requests;
