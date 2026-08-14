export type Theme = {
	panel: number;
	panelBorder: number;
	text: number;
	textMuted: number;
	control: number;
	controlHover: number;
	controlActive: number;
	accent: number;
	accentMuted: number;
	focusRing: number;
	shadow: number;
	fontSize: number;
	padding: number;
	borderWidth: number;
	/** Corner radius as a fraction of the shorter side, 0 to 1. */
	roundness: number;
};

export const defaultTheme: Theme = {
	panel: 0x171a21ff,
	panelBorder: 0x2b313cff,
	text: 0xeef1f6ff,
	textMuted: 0x8b93a1ff,
	control: 0x232833ff,
	controlHover: 0x2f3542ff,
	controlActive: 0x3b4252ff,
	accent: 0x5b8defff,
	accentMuted: 0x5b8def55,
	focusRing: 0x8fb4ffff,
	shadow: 0x00000055,
	fontSize: 18,
	padding: 10,
	borderWidth: 1,
	roundness: 0.3,
};
