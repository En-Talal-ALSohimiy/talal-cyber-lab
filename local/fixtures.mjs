export function fixtures() {
  const text = Buffer.from(
    'Talal synthetic forensic evidence. No personal data.\n'.repeat(2000),
  );
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  const stream = 'BT /F1 12 Tf 10 100 Td (Talal training) Tj ET';
  objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  let pdf = '%PDF-1.4\n',
    offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf +=
    `xref\n0 6\n0000000000 65535 f \n` +
    offsets
      .slice(1)
      .map((o) => `${String(o).padStart(10, '0')} 00000 n \n`)
      .join('') +
    `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const fat = Buffer.alloc(1474560);
  fat.set([0xeb, 0x3c, 0x90]);
  fat.write('MSDOS5.0', 3);
  fat.writeUInt16LE(512, 11);
  fat[13] = 1;
  fat.writeUInt16LE(1, 14);
  fat[16] = 2;
  fat.writeUInt16LE(224, 17);
  fat.writeUInt16LE(2880, 19);
  fat[21] = 0xf0;
  fat.writeUInt16LE(9, 22);
  fat.writeUInt16LE(18, 24);
  fat.writeUInt16LE(2, 26);
  fat[38] = 0x29;
  fat.writeUInt32LE(123456, 39);
  fat.write('TALAL LAB  ', 43);
  fat.write('FAT12   ', 54);
  fat[510] = 0x55;
  fat[511] = 0xaa;
  fat.set([0xf0, 0xff, 0xff], 512);
  fat.set([0xf0, 0xff, 0xff], 5120);
  const disk = Buffer.alloc(fat.length + 512);
  fat.copy(disk, 512);
  disk[446 + 4] = 1;
  disk.writeUInt32LE(1, 454);
  disk.writeUInt32LE(2880, 458);
  disk[510] = 0x55;
  disk[511] = 0xaa;
  const packet = Buffer.from(
    '0000000000020000000000010800450000200001000040110000c000020ac000021404d21f90000c000054455354',
    'hex',
  );
  const pcap = Buffer.alloc(40 + packet.length);
  pcap.writeUInt32LE(0xa1b2c3d4, 0);
  pcap.writeUInt16LE(2, 4);
  pcap.writeUInt16LE(4, 6);
  pcap.writeUInt32LE(65535, 16);
  pcap.writeUInt32LE(1, 20);
  pcap.writeUInt32LE(1700000000, 24);
  pcap.writeUInt32LE(packet.length, 32);
  pcap.writeUInt32LE(packet.length, 36);
  packet.copy(pcap, 40);
  return {
    text,
    pdf: Buffer.from(pdf),
    fat,
    disk,
    pcap,
    yara: Buffer.from('Synthetic fixture: EICAR-STANDARD-ANTIVIRUS-TEST-FILE'),
  };
}

