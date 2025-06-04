import { json } from '@sveltejs/kit';
import { convertIcsCalendar, type IcsCalendar } from 'ts-ics';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { RequestHandler } from './$types';
import { CONFIG } from '$env/static/private';

interface Calendar {
	name: string;
	icsUrl: string;
}

interface CalendarData {
	name: string;
	events: any[];
}

export const GET: RequestHandler = async () => {
	try {
		let finalConfig;

		if (CONFIG) {
			try {
				finalConfig = JSON.parse(CONFIG);
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

		return json(calendarData);
	} catch (error) {
		console.error('Failed to load calendars:', error);
		return json([], { status: 500 });
	}
};
