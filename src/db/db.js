const get_logger = require('../utils/logger');
const log = get_logger('b0t', __filename, 'aqua');
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
		log.info('Schema applied successfully.');
	}
	catch (err)
	{
		log.error('Error applying schema:', err.message);
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

		log.info('Connected to SQLite database.');

		if (!db_exists)
		{
			log.info('Database does not exist. Creating and applying schema...');
			db_created = true;
		}

		await apply_schema();  // Ensure schema is applied on every startup
	}
	catch (err)
	{
		log.error('Error connecting to SQLite database:', err.message);
		throw err;
	}
};

// Insert a row into the database dynamically
const insert_row = async (table, args = {}) =>
{
	try
	{
		const columns = Object.keys(args).join(', ');
		const placeholders = Object.keys(args).map(() => '?').join(', ');
		const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`;
		const params = Object.values(args);

		log.debug('Insert row:', { sql, params });

		// Execute the insert query and return the last inserted row ID
		const result = await db.run(sql, params);
		return result.lastID;
	}
	catch (err)
	{
		log.error('Error inserting row into the database:', err.message);
		throw err;
	}
};

// Insert multiple rows into the database dynamically
const insert_rows = async (table, rows = []) =>
{
	if (!Array.isArray(rows) || rows.length === 0)
	{
		throw new Error('Rows should be a non-empty array.');
	}

	try
	{
		const columns = Object.keys(rows[0]).join(', ');
		const placeholders = Object.keys(rows[0]).map(() => '?').join(', ');
		const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`;

		await db.run('BEGIN TRANSACTION');
		for (const row of rows)
		{
			const params = Object.values(row);
			await db.run(sql, params); // Insert each row
		}
		// Commit the transaction
		await db.run('COMMIT');
		log.debug('All rows inserted successfully.');
	}
	catch (err)
	{
		// Rollback the transaction in case of an error
		await db.run('ROLLBACK');
		log.error('Error inserting multiple rows into the database:', err.message);
		throw err;
	}
};

// General query runner for other modules to use
const run_query = async (query, params = []) =>
{
	log.debug({ query, params });
	try
	{
		const result = await db.run(query, params);
		log.info({ result });
		return result.lastID || null;
	}
	catch (err)
	{
		log.error(`Error running query: ${query}`, err.message);
		throw err;
	}
};

// Get single row by args
const get_row_by_args = async (table, args = {}) =>
{
	try
	{
		let sql = `SELECT * FROM ${table}`;
		let params = [];

		if(Object.keys(args).length > 0)
		{
			const conditions = Object.keys(args).map((key) => `${key} = ? COLLATE NOCASE`).join(' AND ');
			sql += ` WHERE ${conditions}`;
			params = Object.values(args);
		}

		sql += ' LIMIT 1';

		log.debug('get_row_by_args:', { sql, params });
		const result = await db.get(sql, params);
		log.debug({ result });
		return result ? result : null;
	}
	catch (err)
	{
		log.error('Error fetching row from the database:', err.message);
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
		log.error('Error fetching row from the database:', err.message);
		throw err;
	}
};

// Get rows by args
const get_rows_by_args = async (table, args = {}) =>
{
	try
	{
		let sql = `SELECT * FROM ${table}`;
		let params = [];

		if(Object.keys(args).length > 0)
		{
			const conditions = Object.keys(args).map((key) => `${key} = ?`).join(' AND ');
			sql += ` WHERE ${conditions}`;
			params = Object.values(args);
		}

		log.debug('get_rows_by_args:', { sql, params });

		return await db.all(sql, params);
	}
	catch (err)
	{
		log.error('Error fetching rows from the database:', err.message);
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
		log.error('Error fetching rows from the database:', err.message);
		throw err;
	}
};

// Insert or update a row dynamically based on a unique constraint (id or other unique column)
const upsert_row = async (table, data, unique_column) =>
{
	try
	{
		const columns = Object.keys(data);
		const values = Object.values(data);
		const placeholders = columns.map(() => '?').join(', ');
		const update_clause = columns.map(col => `${col} = ?`).join(', ');
		const sql = `
				INSERT INTO ${table} (${columns.join(', ')})
				VALUES (${placeholders})
				ON CONFLICT (${unique_column})
				DO UPDATE SET ${update_clause};
			`;

		// The values array will be passed twice for both INSERT and UPDATE
		const params = [...values, ...values];

		const result = await db.run(sql, params);
		log.debug(`Upsert operation successful for ${table}.`, { table, data });
		return result;
	}
	catch (err)
	{
		log.error('Error in upsert operation:', err.message);
		throw err;
	}
};


// Update a row in the database by id
const update_row_by_id = async (table, id, fields) =>
{
	try
	{
		// Create the SQL query dynamically
		const set_clause = Object.keys(fields).map(field => `${field} = ?`).join(', ');
		const values = Object.values(fields);
		values.push(id);

		// Construct and execute the SQL query
		const query = `UPDATE ${table} SET ${set_clause} WHERE id = ?`;
		await db.run(query, values);

		log.debug(`Row with id ${id} updated successfully in ${table}.`);
	}
	catch (err)
	{
		log.error(`Error updating row with id ${id} in table ${table}:`, err.message);
		throw err;
	}
};

// Delete a row from the database by id
const delete_row_by_id = async (table, id) =>
{
	try
	{
		const query = `DELETE FROM ${table} WHERE id = ?`;
		await db.run(query, [id]);

		log.debug(`Row with id ${id} deleted successfully from ${table}.`);
	}
	catch (err)
	{
		log.error(`Error deleting row with id ${id} from table ${table}:`, err.message);
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
			log.info('Database connection closed.');
		}
		catch (err)
		{
			log.error('Error closing the SQLite database:', err.message);
			throw err;
		}
	}
};

module.exports = {
	initialize_db,
	db_created,
	run_query,
	insert_row,
	insert_rows,
	upsert_row,
	get_row_by_args,
	get_row,
	get_rows_by_args,
	get_all_rows,
	update_row_by_id,
	delete_row_by_id,
	close_db
};
