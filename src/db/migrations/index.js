// aggregates all the migration functions

const migrate_nicks = require('./nicks');
const migrate_bugs_requests = require('./bugs_requests');
const migrate_speak = require('./speak');
const migrate_kinkshame = require('./kinkshame');
const migrate_infobot = require('./infobot');
const migrate_topics = require('./topics');
const migrate_polls = require('./polls');
const migrate_creeds = require('./creeds');

const migrate_all_tables = async (config) =>
{
	await migrate_nicks(config);
	// await migrate_bugs_requests(config);
	// await migrate_speak(config);
	// await migrate_kinkshame(config);
	// await migrate_infobot(config);
	// await migrate_topics(config);
	// await migrate_polls(config);
	// await migrate_creeds(config);
};

module.exports = {
	migrate_nicks,
	migrate_bugs_requests,
	migrate_speak,
	migrate_kinkshame,
	migrate_infobot,
	migrate_topics,
	migrate_polls,
	migrate_creeds,
	migrate_all_tables,
};
