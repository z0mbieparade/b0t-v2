const get_logger = require('./logger');
const log = get_logger('b0t', __filename, 'orange');
const path = require('path');
const fs = require('fs');

const get_repo_base_path = (current_path = __dirname) =>
{
	while (current_path !== '/')
	{
		if (fs.existsSync(path.join(current_path, '.git')))
		{
			return current_path;
		}
		current_path = path.dirname(current_path);
	}

	return null;
};

module.exports = {
	get_repo_base_path
};