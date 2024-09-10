const get_logger = require('../utils/logger');
const log = get_logger('b0t', __filename, 'lime');
const { colorize_string } = require('../utils/color');
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
	try
	{
		switch (type)
		{
			case 'boolean':
				if(input === true || input === 1) return true;
				if(input === false || input === 0) return false;
				return ['yes', 'y', 'true', '1'].includes(input.toLowerCase());
			case 'number':
				return validate_input(input, regex) ? parseInt(input, 10) : NaN;
			case 'array':
				let arr = [];
				if(Array.isArray(input))
				{
					arr = input;
				}
				else
				{
					arr = input.split(',');
				}

				return arr.map((item) => typeof item === 'string' ? item.trim() : item)
					.filter((item) => validate_input(item, regex));

			default:
				return validate_input(input, regex, options) ? input : null;
		}
	}
	catch(error)
	{
		log.error('process_input failed!', { input, type, regex, options, error });
		return input;
	}
};

// Function to format the question text with options and default values
const format_question_text = (question, options, default_value, edit_existing_data) =>
{
	let formatted_question = question;
	if (options) formatted_question += colorize_string(` (options: ${options.join(', ')})`, 'yellow');
	if (default_value !== undefined)
	{
		formatted_question += edit_existing_data ? colorize_string(` (current: ${default_value})`, 'green') : colorize_string(` (default: ${default_value})`, 'gray');
	}
	return `${formatted_question}: `;
};

// Helper function to use async/await with readline question
const ask_question = (query) =>
{
	return new Promise((resolve) => rl.question(query, resolve));
};

// Function to ask a single question and process the input
const ask_single_question = async (question, current_config, key, edit_existing_data) =>
{
	log.info('Single Question:', { key, edit_existing_data, question, current_config });

	let existing_data = edit_existing_data ? current_config : false;
	let q_default = existing_data && existing_data[key] ? existing_data[key] : question.default;
	if(question.get_data)
	{
		existing_data = await question.get_data();
		if(existing_data[key] !== undefined)
		{
			edit_existing_data = true;
			q_default = existing_data[key];
		}
	}

	const processed_default = process_input(q_default, question.type, question.regex, question.options);
	const formatted_question = format_question_text(question.question, question.options, processed_default, edit_existing_data);
	const answer = await ask_question(formatted_question);
	const final_answer = answer || processed_default;
	const processed_answer = process_input(final_answer, question.type, question.regex, question.options);

	if (processed_answer !== null)
	{
		current_config[key] = processed_answer;
		if(existing_data) existing_data[key] = processed_answer;

		console.log(colorize_string(processed_answer, 'lime'));
		console.log('');

		if (question.repeatable !== true)
		{
			let func = existing_data ? 'update' : 'insert';
			func = question[func] ? func : 'upsert';

			if(question[func])
			{
				log.debug(`Single Question.${func}()`, { processed_answer });

				try
				{
					await question[func](processed_answer);
				}
				catch (err)
				{
					log.error(`Error in ${key}.${func}():`, err);
				}
			}
		}
	}
	else
	{
		log.warn(`Invalid input for ${key}: ${final_answer}`);
		return ask_single_question(question, current_config, key);
	}
};

// Function to ask the same question or subquestions until a user says no to another entry
const ask_repeatable_question = async (question, current_config, key) =>
{
	log.debug('Repeatable question:', { key, question, current_config });

	const results = [];

	const ask_sub_questions_and_repeat = async (entry, edit_existing_data) =>
	{
		const sub_questions = question.sub_questions[entry[question.key]] || question.sub_questions.any;

		log.debug('ask_sub_questions_and_repeat:', { entry, sub_questions });

		if (sub_questions)
		{
			await ask_questions(sub_questions, entry, edit_existing_data);
			const processed_answer = process_input(entry, question.type, question.regex, question.options);

			let func = edit_existing_data ? 'update' : 'insert';
			func = question[func] ? func : 'upsert';

			if(question[func])
			{
				log.debug(`Sub Question.${func}()`, { processed_answer });

				try
				{
					await question[func](entry, current_config);
				}
				catch (err)
				{
					log.error(`Error in ${key}.${func}():`, err);
				}
			}

			const answer = await ask_question(`${question.repeat_question || 'Add another entry'} (options: yes/no) (default: no): `);

			if (['yes', 'y', '1', 'true'].includes(answer.toLowerCase()) || [true, 1].includes(answer))
			{
				console.log(colorize_string('yes', 'lime'));
				console.log('');
				return ask_main_question({});  // Recursively ask more entries
			}
			else
			{
				console.log(colorize_string('no', 'red'));
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

	// Handle edit or add options for existing data
	const edit_or_add_options = async (existing_data) =>
	{
		log.debug('Existing data:', existing_data);

		if(Array.isArray(existing_data))
		{
			let options = question.existing_question || 'Choose an option';
			options += ': \n1 - Edit a row \n2 - Delete a row \n3 - Add a new row \n4 - Skip and continue';
			const answer = await ask_question(`${options} (default: 3): `);
			const choice = parseInt(answer, 10);

			if (choice === 1) // Edit a row
			{
				existing_data.forEach((row, i) =>
				{
					let row_str = '';
					for(const key in row)
					{
						if(key === 'id' || row[key] === null || row[key] === '') continue;
						row_str += key + ':' + row[key] + ' ';
					}
					console.log(colorize_string(`${(i + 1)}) ${row_str}`, 'yellow'));
				});

				const row_to_edit = await ask_question(`Enter row number to edit (1-${existing_data.length}): `);
				const index = parseInt(row_to_edit, 10) - 1;
				if (index >= 0 && index < existing_data.length)
				{
					log.debug('Edit row:', { index, row: existing_data[index], question });

					await ask_single_question(question, existing_data[index], question.key, true); // Ask main question
					await ask_sub_questions_and_repeat(existing_data[index], true);  // Ask sub-questions for the row
				}
				else
				{
					console.log(colorize_string('Invalid row number.', 'red'));
				}
			}
			else if (choice === 2) // Delete an existing row
			{
				existing_data.forEach((row, i) =>
				{
					let row_str = '';
					for(const key in row)
					{
						if(key === 'id' || row[key] === null || row[key] === '') continue;
						row_str += key + ':' + row[key] + ' ';
					}

					console.log(colorize_string(`${(i + 1)}) ${row_str}`, 'yellow'));
				});

				const row_to_delete = await ask_question(`Enter row number to delete (1-${existing_data.length}): `);
				const index = parseInt(row_to_delete, 10) - 1;
				if (index >= 0 && index < existing_data.length)
				{
					log.debug('Delete row:', { index, row: existing_data[index], question });
					const delete_row = await ask_question(`Are you sure you want to delete row ${(index + 1)}? (default: no): `);

					if (['yes', 'y', '1', 'true'].includes(delete_row.toLowerCase()) || [true, 1].includes(delete_row))
					{
						if(question.delete)
						{
							log.debug('Question.delete()', { index, existing_data });

							try
							{
								log.debug('Question.delete()');
								await question.delete(existing_data[index]);
								console.log(colorize_string(`Delete row: ${(index + 1)}`, 'lime'));
								await edit_or_add_options(existing_data); //return to our choices
							}
							catch (err)
							{
								log.error(`Error in ${key}.delete():`, err);
							}
						}
						else
						{
							log.error('No delete function for question', question);
							await edit_or_add_options(existing_data); //return to our choices
						}
					}
					else
					{
						await edit_or_add_options(existing_data); //return to our choices
					}
				}
				else
				{
					console.log(colorize_string('Invalid row number.', 'red'));
					await edit_or_add_options(existing_data); //return to our choices
				}
			}
			else if (choice === 3) // Add a new row
			{
				await ask_main_question({}); // Ask for a new row
			}
			// If choice is 4 or invalid, we skip
		}
		else if(typeof existing_data === 'object' && existing_data !== null && existing_data !== undefined)
		{
			//idk do something if it's just a {key: data} object
		}
	};

	const ask_main_question = async (entry) =>
	{
		log.debug('ask_main_question:', { entry });

		if(question.get_data)
		{
			const existing_data = await question.get_data(current_config);

			if(existing_data && existing_data[question.key])
			{
				await edit_or_add_options(existing_data);
			}
		}
		else
		{
			await ask_single_question(question, entry, question.key);
			await ask_sub_questions_and_repeat(entry);
		}
	};

	if(question.get_data_all)
	{
		const existing_data = await question.get_data_all(current_config);

		if (Array.isArray(existing_data) && existing_data.length > 0)
		{
			await edit_or_add_options(existing_data);
		}
		else
		{
			await ask_main_question({});
		}
	}
	else
	{
		await ask_main_question({});
	}
};

// Main function to ask questions dynamically, handling sub-questions and repeatable questions
const ask_questions = async (questions, current_config, edit_existing_data) =>
{
	log.debug('ask_questions:', { edit_existing_data, questions, current_config });

	for (const key in questions)
	{
		const question = questions[key];
		const q_key = question.key || key;
		if (question.repeatable)
		{
			await ask_repeatable_question(question, current_config, q_key);
		}
		else
		{
			await ask_single_question(question, current_config, q_key, edit_existing_data);

			if (question.sub_questions && current_config[q_key])
			{
				const sub_questions_key = current_config[q_key];
				const sub_questions = question.sub_questions[sub_questions_key] || question.sub_questions.any;

				if (sub_questions)
				{
					await ask_questions(sub_questions, current_config);
				}
			}
		}
	}
};

// Function to run the setup based on a question set
const start = async (questions = {}) =>
{
	const config = {};

	await ask_questions(questions, config);
	rl.close();
	return config;
};

// Export the setup function
module.exports = {
	start
};
