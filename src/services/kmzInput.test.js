import assert from 'node:assert/strict';
import test from 'node:test';
import { BlobWriter, TextReader, Uint8ArrayReader, ZipReader, ZipWriter } from '@zip.js/zip.js';
import { MAX_KML_BYTES, prepareKmlUpload } from './kmzInput.js';

const KML = '\uFEFF<?xml version="1.0" encoding="UTF-8"?>\r\n'
  + '<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">'
  + '<Document><name>亚丁</name><Placemark><Point><coordinates>100,28,4000</coordinates></Point></Placemark>'
  + '<Placemark><gx:Track><when>2026-07-20T05:45:43Z</when><gx:coord>100 28 4000</gx:coord></gx:Track></Placemark>'
  + '<Placemark><gx:Track><when>2026-07-21T00:32:35Z</when><gx:coord>101 29 4100</gx:coord></gx:Track></Placemark>'
  + '</Document></kml>';

async function archive(entries, filename = 'route.kmz') {
  const writer = new ZipWriter(new BlobWriter('application/vnd.google-earth.kmz'), {
    useWebWorkers: false,
    dataDescriptor: false,
    zip64: false,
  });
  for (const [name, content, options = {}] of entries) {
    await writer.add(name, typeof content === 'string' ? new TextReader(content) : new Uint8ArrayReader(content), options);
  }
  return new File([await writer.close()], filename, { lastModified: 123456789 });
}

async function mutateArchive(file, mutate) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer);
  const end = bytes.length - 22;
  assert.equal(view.getUint32(end, true), 0x06054b50);
  const centralOffset = view.getUint32(end + 16, true);
  assert.equal(view.getUint32(centralOffset, true), 0x02014b50);
  const localOffset = view.getUint32(centralOffset + 42, true);
  mutate(view, centralOffset, localOffset, bytes);
  return new File([bytes], file.name);
}

test('ordinary KML and XML are passed through without changing the original file', async () => {
  for (const name of ['route.kml', 'route.KML', 'route.xml']) {
    const file = new File([KML], name);
    assert.equal(await prepareKmlUpload(file), file);
  }
});

test('KMZ keeps all KML bytes, timestamps, recording boundaries and markers unchanged', async () => {
  const file = await archive([['doc.kml', KML]], '亚丁.KMZ');
  const result = await prepareKmlUpload(file);
  assert.equal(result.name, '亚丁.kml');
  assert.equal(result.type, 'application/vnd.google-earth.kml+xml');
  assert.equal(result.lastModified, file.lastModified);
  assert.deepEqual(new Uint8Array(await result.arrayBuffer()), new TextEncoder().encode(KML));
});

test('the unique root doc.kml takes precedence over other KML documents', async () => {
  const file = await archive([['other.kml', '<kml/>'], ['DOC.KML', KML], ['files/photo.png', 'photo']]);
  const result = await prepareKmlUpload(file);
  assert.deepEqual(new Uint8Array(await result.arrayBuffer()), new TextEncoder().encode(KML));
});

test('a unique nested KML is accepted when no root doc.kml exists', async () => {
  const file = await archive([['files/photo.png', 'photo'], ['tracks/路线.KML', KML]]);
  assert.deepEqual(new Uint8Array(await (await prepareKmlUpload(file)).arrayBuffer()), new TextEncoder().encode(KML));
});

test('duplicate case-insensitive root documents are rejected instead of selecting one', async () => {
  await assert.rejects(prepareKmlUpload(await archive([['doc.kml', KML], ['DOC.KML', '<kml/>']])), /多个|重复/);
});

test('multiple KML documents without a root main document are rejected', async () => {
  await assert.rejects(prepareKmlUpload(await archive([['a.kml', KML], ['b.kml', KML]])), /多个|主文档/);
});

test('archives without a KML document are rejected', async () => {
  await assert.rejects(prepareKmlUpload(await archive([['files/photo.png', 'photo']])), /未找到|不包含/);
});

test('empty selected KML documents are rejected', async () => {
  await assert.rejects(prepareKmlUpload(await archive([['doc.kml', '']])), /为空/);
});

test('invalid ZIP input is rejected, not passed through as KML', async () => {
  await assert.rejects(prepareKmlUpload(new File(['not a ZIP'], 'broken.kmz')), /KMZ/);
});

test('encrypted KML documents are explicitly rejected', async () => {
  const file = await archive([['doc.kml', KML, { password: 'fixture-password', zipCrypto: true }]]);
  await assert.rejects(prepareKmlUpload(file), /加密/);
});

test('declared decompressed size above the existing KML limit is rejected', async () => {
  const file = await mutateArchive(await archive([['doc.kml', KML]]), (view, central, local) => {
    view.setUint32(central + 24, MAX_KML_BYTES + 1, true);
    view.setUint32(local + 22, MAX_KML_BYTES + 1, true);
  });
  await assert.rejects(prepareKmlUpload(file), /20\s*MiB/);
});

test('understated size is rejected by the ZIP decoder before oversized output is accepted', async () => {
  const file = await mutateArchive(await archive([['doc.kml', new Uint8Array(MAX_KML_BYTES + 1)]]), (view, central, local) => {
    view.setUint32(central + 24, 1, true);
    view.setUint32(local + 22, 1, true);
  });
  await assert.rejects(prepareKmlUpload(file), (error) => {
    assert.equal(error.message, '无法解析 KMZ，请检查文件是否损坏或使用了不支持的压缩格式');
    assert.equal(error.cause.message, 'Invalid uncompressed size');
    return true;
  });
});

test('the output writer independently limits cumulative bytes and closes the archive on failure', async (t) => {
  let writes = 0;
  const close = t.mock.method(ZipReader.prototype, 'close', async () => {});
  t.mock.method(ZipReader.prototype, 'getEntries', async () => [{
    filename: 'doc.kml', uncompressedSize: 1, encrypted: false, directory: false,
    async getData(output) {
      const writer = output.getWriter();
      try {
        await writer.write(new Uint8Array(MAX_KML_BYTES));
        writes++;
        await writer.write(new Uint8Array(1));
        writes++;
      } finally {
        writer.releaseLock();
      }
    },
  }]);
  await assert.rejects(prepareKmlUpload(new File(['fixture'], 'route.kmz')), /20\s*MiB/);
  assert.equal(writes, 1);
  assert.equal(close.mock.callCount(), 1);
});

test('selected KML checksum failures prevent returning a partially decoded file', async () => {
  const file = await mutateArchive(await archive([['doc.kml', KML, { level: 0 }]]), (view, central, local, bytes) => {
    const dataOffset = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    bytes[dataOffset] ^= 1;
  });
  await assert.rejects(prepareKmlUpload(file), /KMZ/);
});

test('unselected image data is not decompressed or validated', async () => {
  const file = await mutateArchive(await archive([
    ['files/photo.png', 'image bytes', { level: 0 }],
    ['doc.kml', KML],
  ]), (view, central, local, bytes) => {
    const dataOffset = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    bytes[dataOffset] ^= 1;
    view.setUint32(central + 24, MAX_KML_BYTES * 100, true);
    view.setUint32(local + 22, MAX_KML_BYTES * 100, true);
  });
  assert.deepEqual(new Uint8Array(await (await prepareKmlUpload(file)).arrayBuffer()), new TextEncoder().encode(KML));
});
