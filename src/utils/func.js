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
	return null;  // Not found
};

module.exports = {
	get_repo_base_path
};