// Guarded localStorage writes — setItem throws on quota-exceeded and in
// Safari/Firefox private mode, which would otherwise crash hot paths
// (e.g. recording every puzzle solve).
export function lsSet(key, value) {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}
