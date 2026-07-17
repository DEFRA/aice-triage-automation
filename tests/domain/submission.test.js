import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { loadSubmissions } from '#/domain/submission.js'

describe('#domain/submission', () => {
  let dir

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'submissions-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true })
  })

  test('returns an empty array when the directory has no .md files', async () => {
    const result = await loadSubmissions(dir)
    expect(result).toEqual([])
  })

  test('derives id from filename without the .md extension', async () => {
    await writeFile(join(dir, '20260605.md'), 'Some content')
    const result = await loadSubmissions(dir)
    expect(result[0].id).toBe('20260605')
  })

  test('returns files sorted by filename', async () => {
    await writeFile(join(dir, 'b.md'), 'B')
    await writeFile(join(dir, 'a.md'), 'A')
    const result = await loadSubmissions(dir)
    expect(result.map((s) => s.id)).toEqual(['a', 'b'])
  })

  test('ignores non-.md files', async () => {
    await writeFile(join(dir, 'keep.md'), 'keep')
    await writeFile(join(dir, 'ignore.txt'), 'ignore')
    const result = await loadSubmissions(dir)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('keep')
  })

  test('strips the boilerplate footer starting with "Reply within N working days"', async () => {
    const raw =
      'Real content\n\nReply within 5 working days with one of:\na recommended pattern'
    await writeFile(join(dir, 'sub.md'), raw)
    const result = await loadSubmissions(dir)
    expect(result[0].text).toBe('Real content')
  })

  test('leaves text unchanged when no boilerplate is present', async () => {
    await writeFile(join(dir, 'sub.md'), 'Just content')
    const result = await loadSubmissions(dir)
    expect(result[0].text).toBe('Just content')
  })
})
