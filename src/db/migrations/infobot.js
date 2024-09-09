const fs = require('fs');
const path = require('path');
const db = require('../db');

const migrate_infobot = () =>
{
	return new Promise((resolve, reject) =>
	{
		const db_file_path = path.join(__dirname, '../../db/infobot.json');
		const json_data = JSON.parse(fs.readFileSync(db_file_path, 'utf8'));

		const infobot = json_data;

		if (!infobot)
		{
			return resolve();
		}

		db.serialize(() =>
		{
			resolve();
		});
	});
};

module.exports = migrate_infobot;
