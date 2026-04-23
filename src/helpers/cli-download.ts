import 'dotenv/config'
import { exportToMemories } from '../functions/index.js'

const type = process.argv[2]
const overwrite = process.argv.includes('--overwrite')

const result = await exportToMemories(type, overwrite)
if (result.error) {
  console.error(`❌ ${result.error}`)
  process.exit(1)
}
console.log(`✅ Exported ${result.exported}/${result.total} memories to MD`)
