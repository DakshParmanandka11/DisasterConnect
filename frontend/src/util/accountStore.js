export function saveLocalAccount({ email, password, user, token }) {
  try {
    const normEmail = String(email).trim().toLowerCase();
    const existingRaw = localStorage.getItem("dc_accounts");
    const accounts = existingRaw ? JSON.parse(existingRaw) : [];
    const idx = accounts.findIndex((a) => a.email === normEmail);
    const item = { email: normEmail, password: String(password), user, token };
    if (idx >= 0) {
      accounts[idx] = item;
    } else {
      accounts.push(item);
    }
    localStorage.setItem("dc_accounts", JSON.stringify(accounts));
  } catch (e) {}
}

export function getLocalAccount(email, password) {
  try {
    const normEmail = String(email).trim().toLowerCase();
    const existingRaw = localStorage.getItem("dc_accounts");
    if (!existingRaw) return null;
    const accounts = JSON.parse(existingRaw);
    const found = accounts.find((a) => a.email === normEmail && a.password === String(password));
    return found || null;
  } catch (e) {
    return null;
  }
}

export function isLocalEmailRegistered(email) {
  try {
    const normEmail = String(email).trim().toLowerCase();
    const existingRaw = localStorage.getItem("dc_accounts");
    if (!existingRaw) return false;
    const accounts = JSON.parse(existingRaw);
    return accounts.some((a) => a.email === normEmail);
  } catch (e) {
    return false;
  }
}
