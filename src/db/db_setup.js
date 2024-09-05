const setup_config = require('../utils/qa');
const fs = require('fs');
const path = require('path');
const init_database = require('./init'); // This would be your table creation logic
const db = require('sqlite3').verbose();

// Path to the questions file
const questions_path = path.join(__dirname, 'db_questions.json');

// Define the database path
const db_path = path.join(__dirname, '../../db/b0t.db');

// Migration functions (simplified here, but you can expand these with actual logic)
const db_migrations = {
    migrateAllTables: (callback) => {
        global.logger.info('Migrating all tables...');
        // Add your table migration logic here
        callback();
    },
    migrateNicksTable: (callback) => {
        global.logger.info('Migrating nicks table...');
        // Add your nicks table migration logic here
        callback();
    },
    // Define other specific table migrations
    migrateSpecificTable: (table, callback) => {
        global.logger.info(`Migrating ${table} table...`);
        // Implement table-specific migration logic here
        callback();
    },
};

// Function to check if the database file exists
const db_exists = () => fs.existsSync(db_path);

// Callback functions to be executed after specific answers
const after_question_callbacks = {
    migrate_old_repo: (answer, proceed) => {
        if (answer) {
            global.logger.info('Running migration logic for old repo...');
            // Example logic for old repo migration
            db_migrations.migrateAllTables(() => {
                proceed(); // Continue to next question
            });
        } else {
            proceed(); // Continue to next question
        }
    },
    migrate_all: (answer, proceed) => {
        if (answer) {
            db_migrations.migrateAllTables(() => {
                proceed();
            });
        } else {
            // If we are not migrating all, ask for each table
            proceed();
        }
    },
    migrate_nicks: (answer, proceed) => {
        if (answer) {
            db_migrations.migrateNicksTable(() => {
                proceed();
            });
        } else {
            proceed();
        }
    },
    // Add more callbacks for specific tables
    migrate_bugs_requests: (answer, proceed) => {
        db_migrations.migrateSpecificTable('bugs_requests', proceed);
    },
    migrate_speak: (answer, proceed) => {
        db_migrations.migrateSpecificTable('speak', proceed);
    },
    migrate_reminders: (answer, proceed) => {
        db_migrations.migrateSpecificTable('reminders', proceed);
    },
    migrate_kinkshame: (answer, proceed) => {
        db_migrations.migrateSpecificTable('kinkshame', proceed);
    },
    migrate_infobot: (answer, proceed) => {
        db_migrations.migrateSpecificTable('infobot', proceed);
    },
    migrate_topics: (answer, proceed) => {
        db_migrations.migrateSpecificTable('topics', proceed);
    },
    migrate_polls: (answer, proceed) => {
        db_migrations.migrateSpecificTable('polls', proceed);
    },
    migrate_creeds: (answer, proceed) => {
        db_migrations.migrateSpecificTable('creeds', proceed);
    },
};

// Function to handle database setup
const setup_db = () => {
    // If the database already exists, just initialize it
    if (db_exists()) {
        global.logger.info('Database already exists. Initializing...');
        init_database();
    } else {
        // If the database doesn't exist, run the setup process
        global.logger.info('No database found. Running setup...');
        setup_config(questions_path, after_question_callbacks, (final_config) => {
            global.logger.info('Setup complete. Final configuration:', final_config);
            init_database(final_config);
        });
    }
};

module.exports = setup_db;
