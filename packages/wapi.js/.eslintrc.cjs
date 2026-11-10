/** @type {import("eslint").Linter.Config} */
module.exports = {
	extends: ['@wapijs/eslint-config/config.node.js'],
	overrides: [
		{
			files: ['test/**/*.ts'],
			rules: {
				// fake fetch implementations and fixtures read better without these
				'@typescript-eslint/require-await': 'off',
				'@typescript-eslint/no-non-null-assertion': 'off',
				'@typescript-eslint/no-unnecessary-type-assertion': 'off'
			}
		}
	]
}
