const globals = require('globals');

module.exports = [
	{
		languageOptions: {
			ecmaVersion: 'latest',  // Specify the ECMAScript version
			sourceType: 'commonjs',
			globals: {
				...globals.node,
				...globals.browser
			}
		},
		rules: {
			'indent': ['error', 'tab', { 'SwitchCase': 1 }],  // Indentation with tabs
			'camelcase': 'off',
			'brace-style': ['error', 'allman', { 'allowSingleLine': true }],  // Braces on a new line unless it's a single-line function
			'quotes': ['error', 'single'],  // Use single quotes for strings
			'semi': ['error', 'always'],  // Require semicolons
			'eqeqeq': 'error',  // Enforce strict equality (===)
			'no-var': 'error',  // Disallow 'var', use 'let' or 'const' instead
			'prefer-const': 'error',  // Prefer 'const' over 'let' where possible
			'no-trailing-spaces': 'error',  // Disallow trailing whitespace
			'space-before-blocks': ['error', 'always'],  // Require space before blocks
			'space-before-function-paren': ['error', 'always'],
			'object-curly-newline': ['error', { 'multiline': true, 'consistent': true }],  // Enforce newlines in object literals
			'object-curly-spacing': ['error', 'always'],  // Enforce spacing inside curly braces
			'no-unused-vars': ['warn', { 'args': 'none' }],  // Disallow unused variables, but allow unused function arguments
			'func-names': 'off',  // Do not enforce function names
			'no-console': 'off'  // Allow console.log (can be set to warn in production)
		}
	}
];