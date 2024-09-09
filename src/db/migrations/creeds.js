const fs = require('fs');
const path = require('path');
const db = require('../db');

const migrate_creeds = () =>
{
	return new Promise((resolve, reject) =>
	{
		const db_file_path = path.join(__dirname, '../../db/creeds.json');
		const json_data = JSON.parse(fs.readFileSync(db_file_path, 'utf8'));

		const creeds = json_data;

		if (!creeds)
		{
			return resolve();
		}

		db.serialize(() =>
		{
			resolve();
		});
	});
};

module.exports = migrate_creeds;
