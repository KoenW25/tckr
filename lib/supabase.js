import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Safari/embedded browsers can occasionally time out on Navigator LockManager
// when many auth reads happen at once. This in-memory lock keeps auth token
// access serialized without relying on navigator.locks.
let lockQueue = Promise.resolve()

async function browserAuthLock(_name, _acquireTimeout, fn) {
  const waitForPrevious = lockQueue
  let releaseCurrent
  lockQueue = new Promise((resolve) => {
    releaseCurrent = resolve
  })

  await waitForPrevious

  try {
    return await fn()
  } finally {
    releaseCurrent()
  }
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    lock: browserAuthLock,
  },
})

export default supabase
