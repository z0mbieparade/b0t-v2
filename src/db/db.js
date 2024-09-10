const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');  // Using sqlite3 driver
const path = require('path');
const fs = require('fs');

const db_path = path.join(__dirname, '../../db/b0t.db');
const schema_path = path.join(__dirname, '../../db/schema.sql');

// Ensure the database directory exists
if (!fs.existsSync(path.dirname(db_path)))
{
	fs.mkdirSync(path.dirname(db_path), { recursive: true });
}

let db;
let db_created = false; // To let b0t.js know if the db was created

// Function to execute the SQL schema
const apply_schema = async () =>
{
	const schema_sql = fs.readFileSync(schema_path, 'utf-8');
	try
	{
		await db.exec(schema_sql);
		global.logger.info('Schema applied successfully.', __filename);
	}
	catch (err)
	{
		global.logger.error('Error applying schema:', err.message, __filename);
		throw err;
	}
};

// Function to initialize the database and apply schema
const initialize_db = async () =>
{
	const db_exists = fs.existsSync(db_path);

	try
	{
		db = await sqlite.open({
			filename: db_path,
			driver: sqlite3.Database
		});

		global.logger.info('Connected to SQLite database.', __filename);

		if (!db_exists)
		{
			global.logger.info('Database does not exist. Creating and applying schema...', __filename);
			db_created = true;
		}

		await apply_schema();  // Ensure schema is applied on every startup
	}
	catch (err)
	{
		global.logger.error('Error connecting to SQLite database:', err.message, __filename);
		throw err;
	}
};

// General query runner for other modules to use
const run_query = async (query, params = []) =>
{
	global.logger.debug({ query, params }, __filename);
	try
	{
		const result = await db.run(query, params);
		global.logger.info({ result }, __filename);
		return result.lastID || null;
	}
	catch (err)
	{
		global.logger.error(`Error running query: ${query}`, err.message, __filename);
		throw err;
	}
};

// Get a single row from the database
const get_row = async (sql, params = []) =>
{
	try
	{
		return await db.get(sql, params);
	}
	catch (err)
	{
		global.logger.error('Error fetching row from the database:', err.message, __filename);
		throw err;
	}
};

// Get all rows from the database
const get_all_rows = async (sql, params = []) =>
{
	try
	{
		return await db.all(sql, params);
	}
	catch (err)
	{
		global.logger.error('Error fetching rows from the database:', err.message, __filename);
		throw err;
	}
};

// Close the database connection
const close_db = async () =>
{
	if (db)
	{
		try
		{
			await db.close();
			global.logger.info('Database connection closed.', __filename);
		}
		catch (err)
		{
			global.logger.error('Error closing the SQLite database:', err.message, __filename);
			throw err;
		}
	}
};

module.exports = {
	initialize_db,
	db_created,
	run_query,
	get_row,
	get_all_rows,
	close_db
};
