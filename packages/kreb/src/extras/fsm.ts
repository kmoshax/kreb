export type TransitionTable = Record<string, Record<string, string>>;

export type StateOf<T> = keyof T & string;

export type EventOf<T> = { [S in keyof T]: keyof T[S] }[keyof T] & string;

export type Transition<T> = {
	from: StateOf<T>;
	to: StateOf<T>;
	event: EventOf<T>;
};

/**
 * States and events are keys of the table, so a typo is a compile error and
 * autocomplete lists what exists. Transition targets are constrained to real
 * state names, which catches the other half of the mistake.
 */
export class Fsm<T extends Record<string, Record<string, StateOf<T>>>> {
	readonly table: T;
	readonly initial: StateOf<T>;

	#current: StateOf<T>;
	readonly #onEnter = new Map<string, ((from: StateOf<T>) => void)[]>();
	readonly #onExit = new Map<string, ((to: StateOf<T>) => void)[]>();

	constructor(table: T, initial?: StateOf<T>) {
		const states = Object.keys(table) as StateOf<T>[];
		const first = initial ?? states[0];

		if (!first) throw new Error('A state machine needs at least one state');
		if (!(first in table)) {
			throw new Error(`Unknown initial state "${first}". Known states: ${states.join(', ')}`);
		}

		this.table = table;
		this.initial = first;
		this.#current = first;
	}

	get current(): StateOf<T> {
		return this.#current;
	}

	is(state: StateOf<T>): boolean {
		return this.#current === state;
	}

	can(event: EventOf<T>): boolean {
		return event in (this.table[this.#current] ?? {});
	}

	/** Returns the transition that fired, or null when the event does not apply. */
	send(event: EventOf<T>): Transition<T> | null {
		const target = this.table[this.#current]?.[event];
		if (target === undefined) return null;

		const from = this.#current;

		for (const listener of this.#onExit.get(from) ?? []) listener(target);
		this.#current = target;
		for (const listener of this.#onEnter.get(target) ?? []) listener(from);

		return { from, to: target, event };
	}

	onEnter(state: StateOf<T>, listener: (from: StateOf<T>) => void): this {
		const listeners = this.#onEnter.get(state) ?? [];
		listeners.push(listener);
		this.#onEnter.set(state, listeners);

		return this;
	}

	onExit(state: StateOf<T>, listener: (to: StateOf<T>) => void): this {
		const listeners = this.#onExit.get(state) ?? [];
		listeners.push(listener);
		this.#onExit.set(state, listeners);

		return this;
	}

	/** Returns to the initial state without running exit or enter listeners. */
	reset(): void {
		this.#current = this.initial;
	}
}

export function fsm<const T extends Record<string, Record<string, StateOf<T>>>>(
	table: T,
	initial?: StateOf<T>,
): Fsm<T> {
	return new Fsm(table, initial);
}
