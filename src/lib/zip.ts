export type ZipFile = { name: string; data: Uint8Array };

function crc32(data: Uint8Array): number {
	let crc = 0xffffffff;
	for (const byte of data) {
		crc ^= byte;
		for (let bit = 0; bit < 8; bit += 1) {
			crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
		}
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function u16(value: number): number[] {
	return [value & 0xff, (value >>> 8) & 0xff];
}

function u32(value: number): number[] {
	return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
}

function concat(chunks: Uint8Array[]): Uint8Array {
	const out = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
	let offset = 0;
	for (const chunk of chunks) {
		out.set(chunk, offset);
		offset += chunk.length;
	}
	return out;
}

export function zipStore(files: ZipFile[]): Uint8Array {
	const locals: Uint8Array[] = [];
	const centrals: Uint8Array[] = [];
	let offset = 0;

	for (const file of files) {
		const name = new TextEncoder().encode(file.name);
		const crc = crc32(file.data);
		const size = file.data.length;
		const local = new Uint8Array([
			...u32(0x04034b50),
			...u16(20),
			...u16(0),
			...u16(0),
			...u16(0),
			...u16(0),
			...u32(crc),
			...u32(size),
			...u32(size),
			...u16(name.length),
			...u16(0),
			...name,
			...file.data
		]);
		const central = new Uint8Array([
			...u32(0x02014b50),
			...u16(20),
			...u16(20),
			...u16(0),
			...u16(0),
			...u16(0),
			...u16(0),
			...u32(crc),
			...u32(size),
			...u32(size),
			...u16(name.length),
			...u16(0),
			...u16(0),
			...u16(0),
			...u16(0),
			...u32(0),
			...u32(offset),
			...name
		]);
		locals.push(local);
		centrals.push(central);
		offset += local.length;
	}

	const centralDir = concat(centrals);
	const end = new Uint8Array([
		...u32(0x06054b50),
		...u16(0),
		...u16(0),
		...u16(files.length),
		...u16(files.length),
		...u32(centralDir.length),
		...u32(offset),
		...u16(0)
	]);
	return concat([...locals, centralDir, end]);
}
