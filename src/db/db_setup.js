/*
This script runs on b0t.js startup if no db.sql file is found.

1. Runs db.js which creates the empty database if it doesn't exist.
2. Ask user a bunch of questions so we can insert server/channel data into the db.
3. Ask if user wants to migrate old v1 b0t data. If true, get b0t v1 path. (should be in the same root folder as this repo)
4. If user says YES to migration, we access b0t/db/*.json files and go table by table to import data.
5. Servers/channels may not match old data, so if linking is required we need to pause mid-table import to prompt user for more data.

*/
const get_logger = require('../utils/logger');
const log = get_logger('b0t', __filename, 'yellow');
const setup = require('../utils/qa');
const db = require('./db');
const {
	migrate_nicks,
	migrate_bugs_requests,
	migrate_speak,
	migrate_kinkshame,
	migrate_infobot,
	migrate_topics,
	migrate_polls,
	migrate_creeds,
	migrate_all_tables
} = require('./migrations');

const setup_db = async () =>
{
	let final_config = {};

	// try
	// {
	final_config = await setup.start({
		bot_name: {
			question: 'What would you like to name your bot',
			default: 'b0t',
			regex: '^[a-zA-Z0-9_-]{3,15}$',
			type: 'string',
			data: false,
			get_data: async function ()
			{
				const bot_name = await db.get_row_by_args('settings', { key: 'bot_name' });

				if(bot_name && bot_name.value)
				{
					this.data = { bot_name: bot_name.value };
				}
				else
				{
					this.data = false;
				}

				return this.data;
			},
			upsert: async function (answer)
			{
				if(answer)
				{
					await db.upsert_row('settings', {
						key: 'bot_name',
						value: answer
					}, 'key');
					await this.get_data();
				}

				return this.data;
			}
		},
		debug_level: {
			question: 'What debug level would you like to set',
			default: 'info',
			options: ['info', 'debug', 'warn', 'error'],
			type: 'string',
			data: false,
			get_data: async function ()
			{
				const debug_level = await db.get_row_by_args('settings', { key: 'debug_level' });

				if(debug_level && debug_level.value)
				{
					this.data = { debug_level: debug_level.value };
				}
				else
				{
					this.data = false;
				}

				return this.data;
			},
			upsert: async function (answer)
			{
				if(answer)
				{
					await db.upsert_row('settings', {
						key: 'debug_level',
						value: answer
					}, 'key');
					await this.get_data();
				}

				return this.data;
			}
		},
		servers: {
			key: 'type',
			question: 'Which platform is this server for',
			repeat_question: 'Add another server',
			existing_question: 'Servers already exist in the db, what would you like to do',
			options: ['discord', 'irc'],
			default: 'irc',
			type: 'string',
			repeatable: true,
			data: [],
			sub_questions: {
				irc: [
					{
						key: 'server',
						question: 'IRC server address',
						default: 'irc.freenode.net',
						regex: '^[a-zA-Z0-9._-]+$',
						type: 'string'
					},
					{
						key: 'port',
						question: 'IRC server port',
						default: 6667,
						type: 'number'
					},
					{
						key: 'ssl',
						question: 'Use SSL',
						default: false,
						type: 'boolean'
					},
					{
						key: 'nickname',
						question: 'IRC bot nickname',
						default: 'b0t',
						regex: '^[a-zA-Z0-9_-]{3,15}$',
						type: 'string'
					},
					{
						key: 'channels',
						question: 'List of channels to join',
						default: '#chat, #general',
						regex: '^#[a-zA-Z0-9_-]+$',
						type: 'array'
					}
				],
				discord: [
					{
						key: 'token',
						question: 'Discord bot token',
						regex: '^.{24,}$',
						type: 'string'
					},
					{
						key: 'server',
						question: 'Discord server name',
						default: 'my_discord_server',
						regex: '^[a-zA-Z0-9_-]{3,30}$',
						type: 'string'
					}
				]
			},
			get_data_all: async function ()
			{
				log.debug('servers get_data_all()');
				const servers = await db.get_rows_by_args('servers');

				if(servers && servers.length > 0)
				{
					this.data = servers;
				}
				else
				{
					this.data = [];
				}

				log.debug('servers:', servers);

				return this.data;
			},
			insert: async function (answer)
			{
				if(answer)
				{
					try
					{
						log.debug('Adding server', answer);

						if(answer.server_type === 'irc')
						{
							await db.insert_row('servers', {
								type: 'irc',
								server: answer.server,
								port: answer.port,
								ssl: answer.ssl,
								nickname: answer.nickname
							});
						}
						else if(answer.server_type === 'discord')
						{
							await db.insert_row('servers', {
								type: 'discord',
								server: answer.server,
								token: answer.token
							});
						}

						log.debug(`Server "${answer.server}" of type "${answer.server_type}" inserted into the database.`);

						await this.get_data_all();
					}
					catch (err)
					{
						log.error(`Error inserting server "${answer.server}": ${err.message}`);
					}

					return this.data;
				}
				else
				{
					await this.get_data_all();
					return this.data;
				}
			},
			update: async function (answer)
			{
				if(answer && answer.id !== undefined) //update a server
				{
					try
					{
						log.debug('Updating server....', answer);
						await db.update_row_by_id('servers', answer.id, answer);
						log.debug('Updated server successfully');

						await this.get_data_all();
					}
					catch(err)
					{
						log.error(`Error updating server "${answer.server}": ${err.message}`);
					}

					return this.data;
				}
				else
				{
					return this.data;
				}
			},
			delete: async function (answer)
			{
				if(answer && answer.id !== undefined) //delete a server
				{
					try
					{
						log.debug('Deleting a server', answer);
						await db.delete_row_by_id('servers', answer.id);
						log.debug('Deleted server successfully');

						await this.get_data_all();
					}
					catch(err)
					{
						log.error(`Error deleting server "${answer.server}": ${err.message}`);
					}

					return this.data;
				}
				else
				{
					return this.data;
				}
			}
		},
		migrate_old_repo: {
			question: 'Migrate an old v1 b0t repo?',
			type: 'boolean',
			default: true,
			sub_questions: {
				true: [
					{
						key: 'old_repo_path',
						question: 'Path to your old b0t repo',
						default: '../b0t',
						regex: '^([a-zA-Z]:)?(\\\\[a-zA-Z0-9_-]+)+\\\\?$|^([/.a-zA-Z0-9_-]+)+/?$',
						type: 'string',
						sub_questions: {
							any: [
								{
									key: 'migrate_all',
									question: 'Migrate all tables',
									default: true,
									type: 'boolean',
									sub_questions: {
										false: [
											{
												key: 'migrate_nicks',
												question: 'Migrate the nicks table',
												default: true,
												type: 'boolean',
												data: {},
												get_data: async function ()
												{
													const nicks = await db.get_row_by_args('nicks');
													const data = {};

													nicks.forEach((nick_row) =>
													{
														data[nick_row.nick + '-' + nick_row.server_id] = {};
													});

													log.info('Get nick data:', data);
													this.data = data;

													return this.data;
												},
												insert: async function (answer, current_config)
												{
													if (answer)
													{
														try
														{
															await migrate_nicks(current_config);
															log.info('Nicks migration completed successfully.');
															this.get_data();
														}
														catch (err)
														{
															log.error('Error during nicks migration:', err);
														}

														return this.data;
													}
													else
													{
														return this.data;
													}
												}
											},
											{
												key: 'migrate_bugs_requests',
												question: 'Migrate the bugs & requests tables',
												default: true,
												type: 'boolean',
												insert: async (answer, current_config) =>
												{
													if (answer)
													{
														try
														{
															await migrate_bugs_requests(current_config);
															log.info('Bugs and requests migration completed successfully.');
														}
														catch (err)
														{
															log.error('Error during bugs/requests migration:', err);
														}
													}
													else
													{
														return Promise.resolve();
													}
												}
											},
											{
												key: 'migrate_speak',
												question: 'Migrate the speak table',
												default: true,
												type: 'boolean',
												insert: async (answer, current_config) =>
												{
													if (answer)
													{
														await migrate_speak(current_config);
													}
												}
											},
											{
												key: 'migrate_kinkshame',
												question: 'Migrate the kinkshame table',
												default: false,
												type: 'boolean',
												insert: async (answer, current_config) =>
												{
													if (answer)
													{
														await migrate_kinkshame(current_config);
													}
												},
											},
											{
												key: 'migrate_infobot',
												question: 'DMigrate the infobot table',
												default: true,
												type: 'boolean',
												insert: async (answer, current_config) =>
												{
													if (answer)
													{
														await migrate_infobot(current_config);
													}
												}
											},
											{
												key: 'migrate_topics',
												question: 'Migrate the topics table',
												default: true,
												type: 'boolean',
												insert: async (answer, current_config) =>
												{
													if (answer)
													{
														await migrate_topics(current_config);
													}
												}
											},
											{
												key: 'migrate_polls',
												question: 'Migrate the polls table',
												default: false,
												type: 'boolean',
												insert: async (answer, current_config) =>
												{
													if (answer)
													{
														await migrate_polls(current_config);
													}
												}
											},
											{
												key: 'migrate_creeds',
												question: 'Migrate the creeds table',
												default: true,
												type: 'boolean',
												insert: async (answer, current_config) =>
												{
													if (answer)
													{
														await migrate_creeds(current_config);
													}
												}
											}
										]
									},
									insert: async (answer, current_config) =>
									{
										if (answer)
										{
											log.info('Starting migration for all tables...');
											try
											{
												await migrate_all_tables(current_config);
												log.info('All migrations completed successfully.');
											}
											catch (err)
											{
												log.error('Error during migration:', err);
											}
										}
										else
										{
											return Promise.resolve();
										}
									}
								}
							]
						}
					}
				]
			}
		}
	});

	log.debug('Config:', final_config);
	// }
	// catch (err)
	// {
	// 	log.error('Error during setup:', err);
	// }

	return final_config;
};

module.exports = setup_db;
