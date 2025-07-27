import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		host: '0.0.0.0', // Listen on all network interfaces
		port: 8080, // Use a different port to avoid sudo
		strictPort: false,
		allowedHosts: [
			'codearcade.cskmitl.com',
			"scoreboard.bornzi.com",
			'localhost',
			'127.0.0.1',
			'10.1.1.5',
			'10.1.1.2'
		],
		cors: true,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization'
		}
	},
	preview: {
		host: '0.0.0.0',
		port: 8080,
		strictPort: false
	}
});
