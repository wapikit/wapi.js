import { defineConfig } from 'tsup'

export default defineConfig({
	entry: ['src/index.ts'],
	format: ['esm', 'cjs'],
	dts: true,
	sourcemap: true,
	clean: true,
	target: 'node20',
	platform: 'neutral',
	external: ['node:http', 'node:net'],
	treeshake: true
})
