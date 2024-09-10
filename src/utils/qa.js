const fs = require('fs');
const readline = require('readline');

// Create an interface for reading input from the terminal
const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

// Function to validate input with regex or options
const validate_input = (input, regex, options) =>
{
	if (options)
	{
		const option_pattern = new RegExp(`^(${options.join('|')})$`, 'i');
		return option_pattern.test(input);
	}
	else if (regex)
	{
		const pattern = new RegExp(regex);
		return pattern.test(input);
	}
	return true;
};

// Function to process and validate inputs based on type and options/regex
const process_input = (input, type, regex, options) =>
{
	switch (type)
	{
		case 'boolean':
			if(input === true) return true;
			if(input === false) return false;
			return ['yes', 'y', 'true'].includes(input.toLowerCase());
		case 'number':
			return validate_input(input, regex) ? parseInt(input, 10) : NaN;
		case 'array':
			return input.split(',').map(item => item.trim());
		default:
			return validate_input(input, regex, options) ? input : null;
	}
};

// Function to check if we need to pause after a question based on the `pause_after` value
const should_pause = (pause_after, answer) =>
{
	if (!pause_after) return false;
	if (pause_after === 'any') return true;
	if (Array.isArray(pause_after)) return pause_after.includes(answer);
	return pause_after === answer;
};

// Function to format the question text with options and default values
const format_question_text = (question, options, default_value) =>
{
	let formatted_question = question;
	if (options) formatted_question += ` (options: ${options.join(', ')})`;
	if (default_value !== undefined) formatted_question += ` (default: ${default_value})`;
	return `${formatted_question}: `;
};

// Function to ask a single question and process the input
const ask_single_question = (question, current_config, key, after_question_callbacks) =>
{
	return new Promise((resolve) =>
	{
		const formatted_question = format_question_text(question.question, question.options, question.default);


		rl.question(formatted_question, (answer) =>
		{
			const final_answer = answer || question.default;
			const processed_answer = process_input(final_answer, question.type, question.regex, question.options);

			if (processed_answer !== null)
			{
				current_config[key] = processed_answer;

				console.log(`\x1b[32m${processed_answer}\x1b[0m`);
				console.log('');

				if (should_pause(question.pause_after, processed_answer) && after_question_callbacks[key])
				{
					const callback_result = after_question_callbacks[key](processed_answer, current_config);

					if (callback_result instanceof Promise)
					{
						callback_result.then(resolve).catch(err =>
						{
							global.logger.error(`Error in after_question_callbacks for ${key}:`, err, __filename);
							resolve();
						});
					}
					else
					{
						resolve();
					}
				}
				else
				{
					resolve();
				}
			}
			else
			{
				global.logger.warn(`Invalid input for ${key}: ${final_answer}`, __filename);
				ask_single_question(question, current_config, key, after_question_callbacks).then(resolve);
			}
		});
	});
};

// Function to ask the same question or subquestions until a user says no to another entry
const ask_repeatable_question = (question, current_config, key, after_question_callbacks) =>
{
	const results = [];

	const ask_sub_questions_and_repeat = async (entry) =>
	{
		const sub_questions = question.sub_questions[entry[question.key]] || question.sub_questions['any'];

		if (sub_questions)
		{
			await ask_questions(sub_questions, entry, after_question_callbacks);

			const processed_answer = process_input(entry, question.type, question.regex, question.options);

			if (should_pause(question.pause_after, processed_answer))
			{
				if (after_question_callbacks && after_question_callbacks[key])
				{
					await after_question_callbacks[key](entry, current_config);  // Await callback handling
				}
			}

			const answer = await new Promise((resolve) =>
			{
				rl.question(`${question.repeat_question || 'Add another entry'} (options: yes/no) (default: no): `, resolve);
			});

			if (['yes', 'y'].includes(answer.toLowerCase()))
			{

				console.log('\x1b[32myes\x1b[0m');
				console.log('');

				return ask_main_question({});  // Recursively ask more entries
			}
			else
			{

				console.log('\x1b[32mno\x1b[0m');
				console.log('');

				results.push(entry);
				current_config[key] = results;
				return;
			}
		}
		else
		{
			// No sub-questions, just store the entry and resolve
			results.push(entry);
			current_config[key] = results;
		}
	};

	const ask_main_question = (entry) =>
	{
		return ask_single_question(question, entry, question.key, after_question_callbacks)
			.then(() => ask_sub_questions_and_repeat(entry));
	};

	return ask_main_question({});
};

// Main function to ask questions dynamically, handling sub-questions and repeatable questions
const ask_questions = (questions, current_config, after_question_callbacks) =>
{
	return questions.reduce((promiseChain, question, i) =>
	{
		return promiseChain.then(() =>
		{
			if (question.repeatable)
			{
				const repeat_key = question.config_key || (question.key + 's');
				return ask_repeatable_question(question, current_config, repeat_key, after_question_callbacks);
			}
			else
			{
				return ask_single_question(question, current_config, question.config_key || question.key, after_question_callbacks)
					.then(() =>
					{
						if (question.sub_questions && current_config[question.key])
						{
							const sub_questions_key = current_config[question.key];
							const sub_questions = question.sub_questions[sub_questions_key] || question.sub_questions['any'];
							if (sub_questions)
							{
								return ask_questions(sub_questions, current_config, after_question_callbacks);
							}
						}
					});
			}
		});
	}, Promise.resolve());
};

// Function to run the setup based on a question set
const setup_config = (questions_path, after_question_callbacks = {}) =>
{
	const questions = JSON.parse(fs.readFileSync(questions_path, 'utf-8'));
	const config = {};

	return ask_questions(questions, config, after_question_callbacks)
		.then(() =>
		{
			rl.close();
			return config;
		});
};

// Export the setup function
module.exports = setup_config;
