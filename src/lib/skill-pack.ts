import { downloadBlob } from './download';
import { zipStore } from './zip';

export const skillPackFiles = [
	'SKILL.md',
	'schema-reference.md',
	'examples.md',
	'README.md'
] as const;

export async function downloadSkillPack(fileUrl: (name: (typeof skillPackFiles)[number]) => string) {
	const encoder = new TextEncoder();
	const loaded = await Promise.all(
		skillPackFiles.map(async (name) => {
			const response = await fetch(fileUrl(name));
			if (!response.ok) throw new Error(`Could not load ${name}`);
			return { name, text: await response.text() };
		})
	);
	const prompt = loaded.map((file) => `# ${file.name}\n\n${file.text.trim()}\n`).join('\n---\n\n');
	const zip = zipStore([
		...loaded.map((file) => ({ name: file.name, data: encoder.encode(file.text) })),
		{ name: 'PROMPT.md', data: encoder.encode(prompt) }
	]);
	const bytes = new Uint8Array(zip.byteLength);
	bytes.set(zip);
	downloadBlob('json-activity-tracker-skills.zip', new Blob([bytes], { type: 'application/zip' }));
}
