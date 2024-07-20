/* eslint-disable no-console */
import { nodeExternalsPlugin } from 'esbuild-node-externals'
import esbuildPluginTsc from 'esbuild-plugin-tsc'
import { context, build } from 'esbuild'
import { TsconfigPathsPlugin } from '@esbuild-plugins/tsconfig-paths'

// Define common options for both development and production builds
const commonOptions = {
	entryPoints: ['./src/index.ts'],
	target: 'es6',
	format: "cjs",
	splitting: false,
	outdir: './dist',
	platform: 'node',
	bundle: true,
	plugins: [
		nodeExternalsPlugin(),
		TsconfigPathsPlugin({ tsconfig: './tsconfig.json' }),
		esbuildPluginTsc({
			tsconfigPath: './tsconfig.json',
			force: true
		})
	]
}

// Development Build
async function buildDevCode() {
	const devOptions = {
		...commonOptions,
		minify: false // Don't minify in development
	}

	const buildContext = await context(devOptions)

	// Add watch mode for development
	await buildContext.watch()
}

// Production Build
async function buildProdCode() {
	const prodOptions = {
		...commonOptions,
		minify: true // Minify in production
	}

	await build(prodOptions)
}

async function buildCode() {
	if (process.argv.includes('--watch')) {
		// If '--watch' argument is provided, run development build
		await buildDevCode()
		console.log('Built code in development watch mode.')
	} else {
		// Otherwise, run production build
		await buildProdCode()
		console.log('Production Build Ready!')
	}
}

buildCode().catch(() => {
	process.exit(1)
})
