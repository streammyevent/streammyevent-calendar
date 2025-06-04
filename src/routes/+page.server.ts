import { convertIcsCalendar } from 'ts-ics';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { error } from '@sveltejs/kit';
import { CONFIG } from '$env/static/private';
import type { PageServerLoad } from './$types';

export const ssr = true;
export const csr = false;

interface Calendar {
	name: string;
	icsUrl: string;
}

interface CalendarData {
	name: string;
	events: any[];
}

export const load: PageServerLoad = async ({ request, url }) => {
	let finalConfig;

	// Check for environment variable first
	const configEnv = CONFIG;
	if (configEnv && configEnv !== '{}') {
		try {
			finalConfig = JSON.parse(configEnv);
		} catch (error) {
			console.error('Failed to parse CONFIG environment variable:', error);
			throw new Error('Invalid CONFIG environment variable format');
		}
	} else {
		// Fall back to config file
		const configPath = join(process.cwd(), 'config.json');
		if (!existsSync(configPath)) {
			throw new Error('No config file found and CONFIG environment variable not set');
		}
		const configText = readFileSync(configPath, 'utf-8');
		finalConfig = JSON.parse(configText);
	}

	// Check authorization header or query param if authToken is configured
	const expectedAuth = finalConfig.authToken;
	if (expectedAuth) {
		const authHeader = request.headers.get('Authorization');
		const authQuery = url.searchParams.get('auth');

		if (authHeader !== expectedAuth && authQuery !== expectedAuth) {
			throw error(401, 'Unauthorized');
		}
	}

	try {
		const calendars: Calendar[] = finalConfig.calendars;

		const calendarData: CalendarData[] = await Promise.all(
			calendars.map(async (calendar) => {
				try {
					const icsResponse = await fetch(calendar.icsUrl);

					if (!icsResponse.ok) {
						throw new Error(`HTTP ${icsResponse.status}: ${icsResponse.statusText}`);
					}

					const icsText = await icsResponse.text();
					const parsed = convertIcsCalendar(undefined, icsText);

					return {
						name: calendar.name,
						events: parsed.events || []
					};
				} catch (error) {
					console.error(`Failed to load calendar ${calendar.name}:`, error);
					return {
						name: calendar.name,
						events: []
					};
				}
			})
		);

		return {
			calendarData
		};
	} catch (error) {
		console.error('Failed to load calendars:', error);
		return {
			calendarData: []
		};
	}
};
