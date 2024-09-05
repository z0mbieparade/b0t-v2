const fs = require('fs');
const readline = require('readline');

// Create an interface for reading input from the terminal
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Function to validate input with regex or options
const validate_input = (input, regex, options) => {
    if (options) {
        const option_pattern = new RegExp(`^(${options.join('|')})$`, 'i');
        return option_pattern.test(input);
    } else if (regex) {
        const pattern = new RegExp(regex);
        return pattern.test(input);
    }
    return true;
};

// Function to process and validate inputs based on type and options/regex
const process_input = (input, type, regex, options) => {
    switch (type) {
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
const should_pause = (pause_after, answer) => {
    if (!pause_after) return false;
    if (pause_after === 'any') return true;
    if (Array.isArray(pause_after)) return pause_after.includes(answer);
    return pause_after === answer;
};

// Function to format the question text with options and default values
const format_question_text = (question, options, default_value) => {
    let formatted_question = question;
    if (options) formatted_question += ` (options: ${options.join(', ')})`;
    if (default_value !== undefined) formatted_question += ` (default: ${default_value})`;
    return `${formatted_question}: `;
};

// Function to ask a single question and process the input
const ask_single_question = (question, current_config, key, callback, after_question_callbacks) => {
    const formatted_question = format_question_text(question.question, question.options, question.default);

    rl.question(formatted_question, (answer) => {
        const final_answer = answer || question.default;
        const processed_answer = process_input(final_answer, question.type, question.regex, question.options);

        if (processed_answer !== null) {
            current_config[key] = processed_answer;

            if (should_pause(question.pause_after, processed_answer)) {
                if (after_question_callbacks && after_question_callbacks[key]) {
                    after_question_callbacks[key](processed_answer, () => callback());
                } else {
                    callback();
                }
            } else {
                callback();
            }
        } else {
            global.logger.warn(`Invalid input for ${key}: ${final_answer}`);
            ask_single_question(question, current_config, key, callback, after_question_callbacks);
        }
    });
};

const ask_repeatable_question = (question, current_config, key, callback, after_question_callbacks) => {
    const results = [];

    const ask_sub_questions_and_repeat = (entry) => {
        const ask_next_entry = () => {
            const sub_questions = question.sub_questions[entry[question.key]] || question.sub_questions['any'];
            if (sub_questions) {
                // Pass the current entry to fill it with sub-questions
                ask_questions(sub_questions, entry, () => {
                    rl.question(`${question.repeat_question || 'Add another entry'} (options: yes/no) (default: no): `, (answer) => {
                        if (['yes', 'y'].includes(answer.toLowerCase())) {
                            const new_entry = {}; // New server entry for the next iteration
                            ask_main_question(new_entry);
                        } else {
                            results.push(entry);  // Push the completed server object
                            current_config[key] = results; // Save all server entries to the config
                            callback(); // Proceed to the next question
                        }
                    });
                }, after_question_callbacks);
            } else {
                results.push(entry); // If no sub-questions, just store the entry
                current_config[key] = results;
                callback();
            }
        };
        ask_next_entry();
    };

    const ask_main_question = (entry) => {
        ask_single_question(question, entry, question.key, () => {
            ask_sub_questions_and_repeat(entry); // Proceed to sub-questions and repeatability
        }, after_question_callbacks);
    };

    ask_main_question({});  // Start the first server entry
};

// Main function to ask questions dynamically, handling sub-questions and repeatable questions
const ask_questions = (questions, current_config, callback, after_question_callbacks) => {
    const ask_next = (i) => {
        if (i < questions.length) {
            const question = questions[i];

            const handle_sub_questions = () => {
                if (question.sub_questions && current_config[question.key]) {
                    const sub_questions_key = current_config[question.key];
                    const sub_questions = question.sub_questions[sub_questions_key] || question.sub_questions['any'];
                    if (sub_questions) {
                        ask_questions(sub_questions, current_config, () => ask_next(i + 1), after_question_callbacks);
                    } else {
                        ask_next(i + 1);
                    }
                } else {
                    ask_next(i + 1);
                }
            };

            if (question.repeatable) {
                const repeat_key = question.config_key || (question.key + 's'); // Pluralize if no config_key
                ask_repeatable_question(question, current_config, repeat_key, handle_sub_questions, after_question_callbacks);
            } else {
                ask_single_question(question, current_config, question.config_key || question.key, handle_sub_questions, after_question_callbacks);
            }
        } else {
            callback();
        }
    };
    ask_next(0);
};

// Function to run the setup based on a question set
const setup_config = (questions_path, after_question_callbacks = {}, setup_done_callback) => {
    const questions = JSON.parse(fs.readFileSync(questions_path, 'utf-8'));
    let config = {}; // Config object to store the final configuration
    ask_questions(questions, config, () => {
        rl.close();
        setup_done_callback(config); // Pass the final config to the setup_done_callback
    }, after_question_callbacks);
};


// Export the setup function
module.exports = setup_config;
