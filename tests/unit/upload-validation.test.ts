import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { validateImageUpload } from '../../server/domain/photos/upload-validation'

describe('validateImageUpload', () => {
  it('accepts a real JPEG and sniffs the correct extension', async () => {
    const jpeg = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#336699' } })
      .jpeg()
      .toBuffer()
    const result = await validateImageUpload(jpeg)
    expect(result.mimeType).toBe('image/jpeg')
    expect(result.extension).toBe('.jpg')
  })

  it('accepts a real PNG', async () => {
    const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#336699' } })
      .png()
      .toBuffer()
    const result = await validateImageUpload(png)
    expect(result.mimeType).toBe('image/png')
  })

  it('rejects content whose bytes do not match an allowed image format, regardless of filename', async () => {
    const fakeImage = Buffer.from('this is definitely not a real jpeg, just text pretending to be one')
    await expect(validateImageUpload(fakeImage)).rejects.toThrow(/unsupported|unrecognized/i)
  })

  it('rejects an empty file', async () => {
    await expect(validateImageUpload(Buffer.alloc(0))).rejects.toThrow(/empty/i)
  })
})
