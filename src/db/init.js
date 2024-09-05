const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Path to the SQLite database file and schema file
const db_path = path.join(__dirname, '../../db/b0t.db');
const schema_path = path.join(__dirname, '../../db/schema.sql');
const user_agents_file_path = path.join(__dirname, '../../db/default/UA.txt');
const cah_file_path = path.join(__dirname, '../../db/default/CAH.json');
const creeds_file_path = path.join(__dirname, '../../db/default/creeds.json');
const insults_file_path = path.join(__dirname, '../../db/default/insults.json');
const scopes_file_path = path.join(__dirname, '../../db/default/scopes.json');
const words_file_path = path.join(__dirname, '../../db/default/words.json');

// Ensure the database directory exists
if (!fs.existsSync(path.dirname(db_path))) {
    fs.mkdirSync(path.dirname(db_path), { recursive: true });
}

global.db = false;

// Function to execute the SQL schema file
const execute_schema = (db, callback) => {
    const schema_sql = fs.readFileSync(schema_path, 'utf-8');
    db.exec(schema_sql, (err) => {
        if (err) {
            global.logger.error('Error executing schema.sql:', err);
        } else {
            global.logger.info('Database schema applied successfully.');
        }
        callback();
    });
};

// Function to update only if the file has changed since the last import
const update_if_file_changed = (db, file_path, table_name, insert_query, process_row) => {
    const file_stats = fs.statSync(file_path);
    const last_modified = file_stats.mtimeMs;

    db.get(`SELECT last_modified FROM file_updates WHERE file_name = ?`, [file_path], (err, row) => {
        if (err) {
            global.logger.error(`Error fetching last modified for ${file_path}:`, err.message);
        } else if (!row || last_modified > row.last_modified) {
            // Drop and recreate the table, then import the file data
            db.run(`DELETE FROM ${table_name} WHERE source = 'default'`, (drop_err) => {
                if (drop_err) global.logger.error(`Error clearing default data in ${table_name}:`, drop_err.message);

                const data = JSON.parse(fs.readFileSync(file_path, 'utf-8'));
                const stmt = db.prepare(insert_query);

                data.forEach(row => {
                    stmt.run(process_row(row), (insert_err) => {
                        if (insert_err) global.logger.error(`Error inserting into ${table_name}:`, insert_err);
                    });
                });

                stmt.finalize(() => {
                    db.run(`
                        INSERT INTO file_updates (file_name, last_modified) 
                        VALUES (?, ?) 
                        ON CONFLICT(file_name) 
                        DO UPDATE SET last_modified = excluded.last_modified
                    `, [file_path, last_modified], (update_err) => {
                        if (update_err) global.logger.error('Error updating last_modified:', update_err.message);
                    });
                });
                global.logger.info(`${table_name} table updated from ${file_path}.`);
            });
        } else {
            global.logger.info(`${file_path} has not changed. Skipping update.`);
        }
    });
};

// Function to handle custom data migration from a JSON file
const migrate_custom_data = (db, file_path, table_name, insert_query, process_row) => {
    if (fs.existsSync(file_path)) {
        const data = JSON.parse(fs.readFileSync(file_path, 'utf-8'));
        const stmt = db.prepare(insert_query);

        data.forEach(row => {
            stmt.run(process_row(row), (err) => {
                if (err) global.logger.error(`Error inserting into ${table_name}:`, err);
            });
        });

        stmt.finalize();
        global.logger.info(`${table_name} migration complete.`);
    } else {
        global.logger.warn(`${file_path} not found. Skipping migration for ${table_name}.`);
    }
};

const insert_server = (server_config, callback) => {
    const { server, server_type, token, port, ssl, nickname } = server_config;

    db.run(`
        INSERT INTO servers (type, server, token, port, ssl, nickname)
        VALUES (?, ?, ?, ?, ?, ?)
    `, [server_type, server, token, port, ssl, nickname], function(err) {
        if (err) {
            global.logger.error('Error inserting server:', err);
            callback(err);
        } else {
            global.logger.info(`Server inserted with server_id: ${this.lastID}`);
            callback(null, this.lastID);  // Pass back the server_id
        }
    });
};

const insert_channels = (server_id, channels, callback) => {
    if (!channels || channels.length === 0) {
        callback(null);
        return;
    }

    const channel_stmt = db.prepare(`
        INSERT INTO channels (server_id, name)
        VALUES (?, ?)
    `);

    channels.forEach(channel => {
        channel_stmt.run(server_id, channel, (err) => {
            if (err) {
                global.logger.error('Error inserting channel:', err);
            } else {
                global.logger.info(`Channel ${channel} inserted for server_id ${server_id}`);
            }
        });
    });

    channel_stmt.finalize(callback);
};

const insert_servers_and_channels = (config, callback) => {
    const servers = config.servers;
    const server_ids = {};  // Store server_ids mapped to their server name

    let remaining = servers.length;

    servers.forEach(server => {
        insert_server(server, (err, server_id) => {
            if (err) {
                return callback(err);
            }

            server_ids[server.server_name] = server_id;

            // Insert channels after server is inserted
            insert_channels(server_id, server.channels, (err) => {
                if (err) {
                    global.logger.error('Error inserting channels for server:', err);
                }

                remaining -= 1;
                if (remaining === 0) {
                    callback(null, server_ids);  // Call the callback with all server_ids
                }
            });
        });
    });
};

function import_cah_packs() {
    const cah_data = JSON.parse(fs.readFileSync(cah_file_path, 'utf-8'));

    db.serialize(() => {
        const pack_stmt = db.prepare(`
            INSERT INTO cah_packs (name, official) VALUES (?, ?)
            ON CONFLICT(name) DO NOTHING
        `);

        const card_stmt = db.prepare(`
            INSERT INTO cah_cards (pack_id, text, cid, pid, disabled, type) 
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        cah_data.forEach(pack => {
            // Insert the pack
            pack_stmt.run(pack.name, pack.official, function (err) {
                if (err) {
                    global.logger.error('Error inserting pack:', err);
                } else {
                    const pack_id = this.lastID;

                    // Insert white cards
                    if (pack.white && pack.white.length > 0) {
                        pack.white.forEach(card => {
                            const disabled = card.r === 1;  // Check if r:1, set disabled to true
                            card_stmt.run(pack_id, card.txt || '', card.cid, card.pid, disabled, 'white', (err) => {
                                if (err) {
                                    global.logger.error('Error inserting white card:', err);
                                }
                            });
                        });
                    }

                    // Insert black cards if they exist in the JSON structure
                    if (pack.black && pack.black.length > 0) {
                        pack.black.forEach(card => {
                            const disabled = card.r === 1;  // Same logic for black cards
                            card_stmt.run(pack_id, card.txt || '', card.cid, card.pid, disabled, 'black', (err) => {
                                if (err) {
                                    global.logger.error('Error inserting black card:', err);
                                }
                            });
                        });
                    }
                }
            });
        });

        pack_stmt.finalize();
        card_stmt.finalize();
    });
}

// Main function to initialize the database and handle migrations
function init_database(config) {
    global.db = new sqlite3.Database(db_path, (err) => {
        if (err) {
            global.logger.error('Error opening database:', err.message);
        } else {
            global.logger.info('Connected to the SQLite database.');
        }
    });

    global.db.serialize(() => {
        //Execute the schema.sql file to create the tables
        execute_schema(db, () => {

            if(config && config.servers)
            {
                insert_servers_and_channels(config, (err, server_ids) => {
                    if (err) {
                        global.logger.error('Error inserting servers and channels:', err);
                    } else {
                        //load_and_insert_creeds(server_ids);
                    }
                });
            }

            // //Migrate custom nicks if migrating
            // if (config.migrate_nicks || config.migrate_all) {
            //     const migration_nicks_path = path.join(__dirname, config.old_repo_path + '/db/db.json');
            //     migrate_custom_data(db, migration_nicks_path, 'nicks', 
            //         `INSERT INTO nicks (nick) VALUES (?)`, 
            //         (row) => [row.nick]);
            // }

            // //Update UA.txt if it has changed
            // update_if_file_changed(db, user_agents_file_path, 'user_agents', 
            //     `INSERT INTO user_agents (user_agent, value) VALUES (?, ?)`, 
            //     (row) => [row.user_agent, row.value]);

            // //Update CAH.json only if it has changed
            // update_if_file_changed(cah_file_path, import_cah_packs);

            // if (config.migrate_creeds || config.migrate_all) {
            //     const migration_creeds_path = path.join(__dirname, config.old_repo_path + '/db/creeds.json');
            //     for(let server in config.servers)
            //     {
            //         migrate_custom_data(db, migration_creeds_path, 'creeds', 
            //             `INSERT INTO creeds (server_id, channel_id, creed, disabled) VALUES (?, ?, ?, ?)`, 
            //             (row) => [row.creed, row.disabled]);
            //     }
            // }

            // //Update words.json only if it has changed
            // update_if_file_changed(db, words_file_path, 'creeds', 
            //     `INSERT INTO creeds (server_id, channel_id, creed, disabled) VALUES (?, ?, ?, ?)`, 
            //     (category, word) => [category, word]);

            // //Update words.json only if it has changed
            // update_if_file_changed(db, words_file_path, 'words', 
            //     `INSERT INTO words (category, word, source) VALUES (?, ?, 'default')`, 
            //     (category, word) => [category, word]);

            // //Update words.json only if it has changed
            // update_if_file_changed(db, words_file_path, 'words', 
            //     `INSERT INTO words (category, word, source) VALUES (?, ?, 'default')`, 
            //     (category, word) => [category, word]);

            global.logger.info('Database initialized successfully.');
        });
    });

    // Close the database connection
    global.db.close((err) => {
        if (err) {
            global.logger.error('Error closing database:', err.message);
        } else {
            global.logger.info('Database connection closed.');
        }
    });
}

module.exports = init_database;
