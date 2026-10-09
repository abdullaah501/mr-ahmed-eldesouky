import { describe, it, expect } from 'vitest';
import docxExtractor from '../../lib/ai/resources/documents/docx';
import { getBuffer } from '../../lib/ai/resources/documents/shared';
import { AiError, AiErrorCode } from '../../lib/ai/types/errors';

const WORD_LEGACY_ERROR_PATTERN = /(Word.+legacy|legacy.+Word|Word|legacy)/;

describe('docx extractor', () => {
  it('rejects legacy .doc with explicit Arabic error', async () => {
    const err = await docxExtractor.extract({ name: 'old.doc', type: 'application/msword' }).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(err.code).toBe(AiErrorCode.NOT_IMPLEMENTED);
    expect(err.message).toMatch(WORD_LEGACY_ERROR_PATTERN);
  });

  it('rejects .doc even when buffer is present', async () => {
    const err = await docxExtractor.extract({ name: 'old.doc', type: 'application/msword', buffer: Buffer.from([1, 2, 3]) }).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
  });

  it('accepts .docx', () => {
    expect(docxExtractor.canHandle({ name: 'f.docx' })).toBe(true);
    expect(docxExtractor.canHandle({ type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })).toBe(true);
  });

  it('still accepts .doc in canHandle for messaging (reject happens in extract)', () => {
    expect(docxExtractor.canHandle({ name: 'f.doc' })).toBe(true);
    expect(docxExtractor.canHandle({ type: 'application/msword' })).toBe(true);
  });
});

describe('getBuffer supports arrayBuffer file-likes', () => {
  it('returns Buffer from async arrayBuffer function', async () => {
    const source = { name: 'f.pdf', type: 'application/pdf', arrayBuffer: async () => new Uint8Array([72, 73, 33]).buffer };
    const buf = await getBuffer(source);
    expect(buf).toBeInstanceOf(Buffer);
    expect(Array.from(buf)).toEqual([72, 73, 33]);
  });

  it('returns Buffer when input.bytes is provided', async () => {
    const buf = await getBuffer({ name: 'x', bytes: Buffer.from([1, 2, 3]) });
    expect(Array.from(buf)).toEqual([1, 2, 3]);
  });

  it('returns null when no buffer-like present', async () => {
    expect(await getBuffer({ name: 'x' })).toBeNull();
  });
});