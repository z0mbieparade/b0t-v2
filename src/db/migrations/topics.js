const get_logger = require('../../utils/logger');
const log = get_logger('b0t', __filename);
const fs = require('fs');
const path = require('path');
const db = require('../db');
const {
	get_repo_base_path
} = require('../../utils/func');

const migrate_topics = async (current_config) =>
{
	const table_name = 'topics';
	const repo_base_path = get_repo_base_path();
	const old_repo_path = current_config.old_repo_path || '../b0t';
	const old_db_path = path.join(repo_base_path, old_repo_path + '/db/');

	console.log({ table_name, current_config, old_db_path });

	try
	{
		const db_file_path = path.join(old_db_path, 'topic.json');
		const json_data = JSON.parse(fs.readFileSync(db_file_path, 'utf8'));
		const topics = json_data;

		if (!topics)
		{
			log.info('No ' + table_name + ' to migrate.');
			return;
		}

		log.info(table_name + ' migration completed successfully.');
	}
	catch (error)
	{
		log.error('Error during ' + table_name + ' migration:', error);
		throw error;
	}
};

module.exports = migrate_topics;
