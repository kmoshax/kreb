export type Theme = {
	panel: number;
	panelBorder: number;
	text: number;
	textMuted: number;
	control: number;
	controlHover: number;
	controlActive: number;
	accent: number;
	focusRing: number;
	fontSize: number;
	padding: number;
	borderWidth: number;
};

export const defaultTheme: Theme = {
	panel: 0x1e222aff,
	panelBorder: 0x30363fff,
	text: 0xf5f5f5ff,
	textMuted: 0x9aa0aaff,
	control: 0x2c313aff,
	controlHover: 0x3a414cff,
	controlActive: 0x4a5260ff,
	accent: 0x4f8cf7ff,
	focusRing: 0x7aa8ffff,
	fontSize: 18,
	padding: 8,
	borderWidth: 1,
};
