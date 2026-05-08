const baseUrl = process.env.BACKEND_BASE_URL ?? 'http://192.168.50.112:8001'

async function check(path, label, validate) {
  const response = await fetch(`${baseUrl}${path}`)
  if (!response.ok) {
    throw new Error(`${label} failed with status ${response.status}`)
  }

  const payload = await response.json()
  validate(payload)
  console.log(`OK: ${label}`)
}

async function main() {
  await check('/health', 'health endpoint', (payload) => {
    if (payload.status !== 'ok') {
      throw new Error('health payload missing status=ok')
    }
  })

  await check('/movies/search?title=batman&page=1', 'movie search endpoint', (payload) => {
    if (!Array.isArray(payload.results)) {
      throw new Error('movie search payload missing results array')
    }
  })

  await check('/media-items?limit=1&offset=0', 'media-items list endpoint', (payload) => {
    if (!Array.isArray(payload.results)) {
      throw new Error('media-items payload missing results array')
    }
  })

  console.log(`Smoke test passed against ${baseUrl}`)
}

main().catch((error) => {
  console.error(`Smoke test failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
