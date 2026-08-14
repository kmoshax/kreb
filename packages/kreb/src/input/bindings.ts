export type Binding =
	| { device: 'key'; code: number }
	| { device: 'mouse'; code: number }
	| { device: 'pad'; code: number; gamepad: number };

/** A bare number is a keyboard key; other devices need an explicit wrapper. */
export type BindingInput = number | Binding;

export function key(code: number): Binding {
	return { device: 'key', code };
}

export function mouse(code: number): Binding {
	return { device: 'mouse', code };
}

export function pad(code: number, gamepad = 0): Binding {
	return { device: 'pad', code, gamepad };
}

export function normalize(input: BindingInput): Binding {
	return typeof input === 'number' ? key(input) : input;
}

export type Stick = {
	axisX: number;
	axisY: number;
	gamepad: number;
};

export function stick(axisX: number, axisY: number, gamepad = 0): Stick {
	return { axisX, axisY, gamepad };
}

export type ButtonAction = {
	readonly type: 'button';
	readonly name: string;
	readonly bindings: readonly Binding[];
};

export type DirectionalKeys = {
	up: BindingInput;
	down: BindingInput;
	left: BindingInput;
	right: BindingInput;
};

export type Axis2Action = {
	readonly type: 'axis2';
	readonly name: string;
	readonly up: readonly Binding[];
	readonly down: readonly Binding[];
	readonly left: readonly Binding[];
	readonly right: readonly Binding[];
	readonly stick: Stick | null;
};

export type Action = ButtonAction | Axis2Action;

function toBindings(input: BindingInput | BindingInput[]): Binding[] {
	return (Array.isArray(input) ? input : [input]).map(normalize);
}

export type ActionSpec = BindingInput | BindingInput[] | Axis2Spec;

export type Axis2Spec = {
	readonly kind: 'axis2';
	readonly keys: DirectionalKeys;
	readonly stick: Stick | null;
};

export function axis2(keys: DirectionalKeys, source: Stick | null = null): Axis2Spec {
	return { kind: 'axis2', keys, stick: source };
}

function isAxis2Spec(spec: ActionSpec): spec is Axis2Spec {
	return typeof spec === 'object' && spec !== null && 'kind' in spec && spec.kind === 'axis2';
}

export type ActionMap<Spec extends Record<string, ActionSpec>> = {
	readonly [K in keyof Spec]: Spec[K] extends Axis2Spec ? Axis2Action : ButtonAction;
};

/**
 * Actions are declared values rather than strings, so a renamed action is a
 * compile error and autocomplete lists what exists.
 */
export function actions<Spec extends Record<string, ActionSpec>>(spec: Spec): ActionMap<Spec> {
	const result: Record<string, Action> = {};

	for (const [name, entry] of Object.entries(spec)) {
		if (isAxis2Spec(entry)) {
			result[name] = {
				type: 'axis2',
				name,
				up: toBindings(entry.keys.up),
				down: toBindings(entry.keys.down),
				left: toBindings(entry.keys.left),
				right: toBindings(entry.keys.right),
				stick: entry.stick,
			};
			continue;
		}

		result[name] = { type: 'button', name, bindings: toBindings(entry) };
	}

	return result as ActionMap<Spec>;
}
