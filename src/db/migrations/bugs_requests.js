const fs = require('fs');
const path = require('path');
const { run_query } = require('../db');
const {
	get_repo_base_path
} = require('../../utils/func');

const migrate_bugs_requests = async (current_config) =>
{
	const table_name = 'bugs/requests';
	const repo_base_path = get_repo_base_path();
	const old_repo_path = current_config.old_repo_path || '../b0t';
	const old_db_path = path.join(repo_base_path, old_repo_path + '/db/');

	console.log({ table_name, current_config, old_db_path });

	try
	{
		const db_file_path = path.join(old_db_path, 'db.json');
		const json_data = JSON.parse(fs.readFileSync(db_file_path, 'utf8'));
		const bugs = json_data.bugs;
		const requests = json_data.requests;

		if (!bugs && !requests)
		{
			global.logger.info('No ' + table_name + ' to migrate.', __filename);
			return;
		}

		global.logger.info(table_name + ' migration completed successfully.', __filename);
	}
	catch (error)
	{
		global.logger.error('Error during ' + table_name + ' migration:', error, __filename);
		throw error;
	}
};

module.exports = migrate_bugs_requests;
