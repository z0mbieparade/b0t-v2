const fs = require('fs');
const path = require('path');
const db = require('../db');

const migrate_topics = () =>
{
	return new Promise((resolve, reject) =>
	{
		const db_file_path = path.join(__dirname, '../../db/topic.json');
		const json_data = JSON.parse(fs.readFileSync(db_file_path, 'utf8'));

		const topics = json_data;

		if (!topics)
		{
			return resolve();
		}

		db.serialize(() =>
		{
			resolve();
		});
	});
};

module.exports = migrate_topics;
