const fs = require('fs');
const path = require('path');
const db = require('../db');

const migrate_polls = () =>
{
	return new Promise((resolve, reject) =>
	{
		const db_file_path = path.join(__dirname, '../../db/polls.json');
		const json_data = JSON.parse(fs.readFileSync(db_file_path, 'utf8'));

		const polls = json_data;

		if (!polls)
		{
			return resolve();
		}

		db.serialize(() =>
		{
			resolve();
		});
	});
};

module.exports = migrate_polls;
