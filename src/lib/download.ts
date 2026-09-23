export function downloadBlob(filename: string, blob: Blob) {
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}

export function downloadJson(filename: string, payload: unknown) {
	downloadBlob(
		filename,
		new Blob([JSON.stringify(payload, null, '\t')], { type: 'application/json' })
	);
}
