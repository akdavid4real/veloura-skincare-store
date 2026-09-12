import { ogImageBuffer } from '../server/src/og-image.js'

export default function handler(_req, res) {
  res.setHeader('Content-Type', 'image/jpeg')
  res.setHeader('Content-Length', String(ogImageBuffer.length))
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400')
  res.status(200).send(ogImageBuffer)
}
