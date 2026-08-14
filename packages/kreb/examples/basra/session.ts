// Everything that outlives a scene: preferences and the socket.

import { Net } from './net.ts';

export type Settings = {
	opponentDelay: number;
	showCaptureHints: boolean;
	fanCards: boolean;
	serverUrl: string;
};

export const settings: Settings = {
	opponentDelay: 0.65,
	showCaptureHints: true,
	fanCards: true,
	serverUrl: `ws://localhost:${7777}`,
};

/** One socket for the whole app, so leaving a room does not drop the link. */
export const net = new Net(settings.serverUrl);
