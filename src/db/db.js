const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const db_path = path.join(__dirname, '../../db/b0t.db');
const schema_path = path.join(__dirname, '../../db/schema.sql');

// Ensure the database directory exists
if (!fs.existsSync(path.dirname(db_path)))
{
	fs.mkdirSync(path.dirname(db_path), { recursive: true });
}

// Open or create the database
const db = new sqlite3.Database(db_path, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) =>
{
	if (err && err.code == 'SQLITE_CANTOPEN')
	{
		global.logger.error('Error connecting to SQLite database, attempting to create.');
		apply_schema();
	}
	else if (err)
	{
		global.logger.error('Error connecting to SQLite database:', err.message);
		throw err;
	}
	else
	{
		global.logger.info('Connected to the SQLite database.');
	}
});

// Function to execute the SQL schema
const apply_schema = (callback) =>
{
	const schema_sql = fs.readFileSync(schema_path, 'utf-8');

	db.exec(schema_sql, (err) =>
	{
		if (err)
		{
			global.logger.error('Error applying schema:', err.message);
			return callback(err);
		}
		global.logger.info('Schema applied successfully.');
		callback();
	});
};

// General query runner for other modules to use
const run_query = (query, params = []) =>
{
	return new Promise((resolve, reject) =>
	{
		db.run(query, params, function (err)
		{
			if (err)
			{
				global.logger.error(`Error running query: ${query}`, err.message);
				reject(err);
			}
			else
			{
				resolve(this.lastID || null);
			}
		});
	});
};

/**
 * Get a single row from the database
 * @param {string} sql - The SQL query to execute
 * @param {array} [params] - Optional parameters for the query
 * @returns {Promise<any>} - Resolves with the single row or rejects with error
 */
const get_row = (sql, params = []) =>
{
	return new Promise((resolve, reject) =>
	{
		db.get(sql, params, (err, row) =>
		{
			if (err)
			{
				global.logger.error('Error fetching row from the database:', err);
				return reject(err);
			}
			resolve(row);
		});
	});
};

/**
 * Get all rows from the database
 * @param {string} sql - The SQL query to execute
 * @param {array} [params] - Optional parameters for the query
 * @returns {Promise<any[]>} - Resolves with an array of rows or rejects with error
 */
const get_all_rows = (sql, params = []) =>
{
	return new Promise((resolve, reject) =>
	{
		db.all(sql, params, (err, rows) =>
		{
			if (err)
			{
				global.logger.error('Error fetching rows from the database:', err);
				return reject(err);
			}
			resolve(rows);
		});
	});
};

/**
 * Close the database connection
 */
const close_db = () =>
{
	return new Promise((resolve, reject) =>
	{
		if (db)
		{
			db.close((err) =>
			{
				if (err)
				{
					global.logger.error('Error closing the SQLite database:', err);
					return reject(err);
				}
				global.logger.info('Database connection closed.');
				resolve();
			});
		}
		else
		{
			resolve();
		}
	});
};

module.exports = {
	db,
	run_query,
	get_row,
	get_all_rows,
	close_db
};
