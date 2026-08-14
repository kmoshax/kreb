// The shell around the table: title, settings, and the online lobby.

import { Anchor, actions, Checkbox, input, Key, Label, Scene, Slider, TextInput } from 'kreb';

import { backdrop, hint, menuColumn, note, title } from './chrome.ts';
import { AiController, type Controller, GuestController, HostController } from './controllers.ts';
import type { NetEvent } from './net.ts';
import { normalizeCode, ROOM_CODE_LENGTH } from './protocol.ts';
import { net, settings } from './session.ts';
import { TableScene } from './table.ts';

const BACK = 'Back';

const Act = actions({ back: Key.KEY_ESCAPE });

/** Every screen returns here, so the entry point is a function not a constant. */
export function mainMenu(): Scene {
	return new MainMenu();
}

function startTable(scene: Scene, controller: Controller): void {
	scene.scenes.change(new TableScene(controller, () => scene.scenes.change(mainMenu())));
}

export class MainMenu extends Scene {
	override ready(): void {
		backdrop(this);
		title(this, 'BASRA', 'كوتشينة · the Egyptian card game');

		menuColumn(this, [
			{
				label: 'Play vs computer',
				onPress: () => startTable(this, new AiController(() => settings.opponentDelay)),
			},
			{ label: 'Play online', onPress: () => this.scenes.change(new OnlineMenu()) },
			{ label: 'Settings', onPress: () => this.scenes.change(new SettingsMenu()) },
		]);

		hint(this, 'Match a rank, or sum numbered cards. A jack takes the table.');
	}
}

export class OnlineMenu extends Scene {
	readonly status = new Label('', 'status');
	readonly codeField = new TextInput('', 'code');

	#connectedOnce = false;

	override ready(): void {
		backdrop(this);
		title(this, 'Play online', net.url);

		menuColumn(this, [
			{ label: 'Create a room', onPress: () => net.create() },
			{ label: 'Join the code below', onPress: () => net.join(this.codeField.value) },
			{ label: BACK, onPress: () => this.scenes.change(mainMenu()) },
		]);

		this.codeField.placeholder = 'room code';
		this.codeField.maxLength = ROOM_CODE_LENGTH;
		this.add(this.codeField).place({
			anchor: Anchor.TopLeft,
			x: 96,
			y: 400,
			width: 200,
			height: 40,
		});

		this.add(this.status).place({ anchor: Anchor.TopLeft, x: 96, y: 470, width: 600, height: 26 });
		note(this, 'Run the relay first:  bun examples/basra/server.ts', 520);

		net.connect();
		this.report();
	}

	override update(): void {
		if (input.pressed(Act.back)) {
			this.scenes.change(mainMenu());
			return;
		}

		// Codes are always upper case, so typing lower case just works.
		const typed = normalizeCode(this.codeField.value);
		if (typed !== this.codeField.value) this.codeField.value = typed;

		for (const event of net.drain()) this.handle(event);
	}

	private handle(event: NetEvent): void {
		if (event.t === 'status') {
			if (event.status === 'connected') this.#connectedOnce = true;
			this.report();
			return;
		}

		if (event.t === 'error') {
			this.status.text = event.reason;
			return;
		}

		if (event.t === 'created') {
			this.scenes.change(new LobbyScene(event.code));
			return;
		}

		if (event.t === 'joined') {
			startTable(this, new GuestController(net));
		}
	}

	private report(): void {
		this.status.text =
			net.status === 'connected'
				? 'Connected to the relay'
				: net.status === 'connecting'
					? 'Connecting...'
					: this.#connectedOnce
						? 'Lost the relay'
						: 'No relay running — start it and try again';
	}
}

/** Host waiting room. Becomes the table the moment a guest arrives. */
export class LobbyScene extends Scene {
	readonly status = new Label('Waiting for a player...', 'status');

	constructor(private readonly code: string) {
		super('lobby');
	}

	override ready(): void {
		backdrop(this);
		title(this, this.code, 'share this code');

		this.add(this.status).place({ anchor: Anchor.TopLeft, x: 96, y: 230, width: 600, height: 26 });

		menuColumn(this, [{ label: 'Cancel', onPress: () => this.leave() }], { y: 300 });
		hint(this, 'The other player picks "Join the code below" and types it in.');
	}

	override update(): void {
		if (input.pressed(Act.back)) this.leave();

		for (const event of net.drain()) {
			if (event.t === 'peer' && event.event === 'joined') {
				this.scenes.change(
					new TableScene(new HostController(net), () => this.scenes.change(mainMenu())),
				);
				return;
			}

			if (event.t === 'status' && event.status !== 'connected') {
				this.status.text = 'Lost the relay';
			}
		}
	}

	private leave(): void {
		net.disconnect();
		this.scenes.change(mainMenu());
	}
}

export class SettingsMenu extends Scene {
	readonly delayLabel = new Label('', 'delayLabel');

	override ready(): void {
		backdrop(this);
		title(this, 'Settings', 'saved for this session');

		const delay = this.add(new Slider(settings.opponentDelay, 0.1, 2, 'delay'));
		delay.place({ anchor: Anchor.TopLeft, x: 96, y: 240, width: 320, height: 28 });
		delay.onChange = (value) => {
			settings.opponentDelay = value;
			this.describe(value);
		};

		this.add(this.delayLabel).place({ anchor: Anchor.TopLeft, x: 440, y: 242 });
		this.describe(delay.value);

		const hints = this.add(new Checkbox('Show capture hints', settings.showCaptureHints, 'hints'));
		hints.place({ anchor: Anchor.TopLeft, x: 96, y: 300 });
		hints.onChange = (on) => {
			settings.showCaptureHints = on;
		};

		const fan = this.add(new Checkbox('Fan the cards', settings.fanCards, 'fan'));
		fan.place({ anchor: Anchor.TopLeft, x: 96, y: 348 });
		fan.onChange = (on) => {
			settings.fanCards = on;
		};

		menuColumn(this, [{ label: BACK, onPress: () => this.scenes.change(mainMenu()) }], { y: 430 });
	}

	override update(): void {
		if (input.pressed(Act.back)) this.scenes.change(mainMenu());
	}

	private describe(seconds: number): void {
		this.delayLabel.text = `opponent waits ${seconds.toFixed(2)}s`;
	}
}
