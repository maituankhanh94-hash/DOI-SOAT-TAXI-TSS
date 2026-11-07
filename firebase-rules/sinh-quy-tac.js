// Sinh quy tắc Realtime Database. B = tiền tố vùng dữ liệu ('' = thật, 'test_env/' = thử)
function strict(B){
  const R = `root.child('${B}roles/'+auth.uid`;
  const active = `(auth != null && ${R}+'/active').val() === true)`;
  const mgr = `(${active} && ${R}+'/role').val() === 'manager')`;
  const me = `${R}+'/user').val()`;
  const noRoles = `(auth != null && !root.child('${B}roles').exists())`;
  const readA = { ".read": active }, readM = { ".read": mgr };
  return {
    "login_index": { ".read": true, "$u": { ".write": `${mgr} || ${noRoles}` } },
    "roles": { ".read": mgr,
      "$uid": { ".read": `auth != null && auth.uid === $uid`,
        ".write": `${mgr} || (${noRoles} && auth.uid === $uid && newData.child('role').val() === 'manager' && newData.child('active').val() === true)` } },
    "accounts": { ".read": mgr, "$u": { ".write": `${mgr} || ${noRoles}` } },
    "settings": { ".write": mgr,
      "accounts": readM, "sources": readA, "staff": readA, "carTypes": readA,
      "payments": readA, "planPayments": readA, "lockHour": readA },
    "trips": { ".read": mgr, ".indexOn": ["dateKey"],
      "$id": { ".write": `${mgr} || (${active} && (!data.exists() || data.child('createdBy').val() === ${me}) && (!newData.exists() || newData.child('createdBy').val() === ${me}))` } },
    "users_trips": { "$user": { ".indexOn": ["dateKey"], ".read": `${mgr} || (${active} && $user === ${me})`, ".write": `${mgr} || (${active} && $user === ${me})` } },
    "places": { ".read": active, ".indexOn": ["n"],
      "$p": { ".write": active,
        ".validate": "newData.hasChildren(['name', 'n']) && newData.child('name').isString() && newData.child('name').val().length <= 200 && newData.child('n').isNumber()" } },
    "meta": { ".read": active, ".write": mgr },
    "deleted_trips": { ".read": mgr, ".write": mgr },
    "drivers": { ".read": mgr, ".write": mgr }
  };
}
const pub = { ".read": true, ".write": true };
const legacyPublic = { trips: pub, users_trips: pub, settings: pub, deleted_trips: pub, drivers: pub, accounts: pub, roles: pub, login_index: pub, places: pub, meta: pub };
const step1 = { rules: Object.assign({}, legacyPublic, { test_env: strict('test_env/') }) };
const step2 = { rules: Object.assign({}, strict(''), { test_env: strict('test_env/') }) };
const fs = require('fs'); const out = process.argv[2];
fs.writeFileSync(out + '/quy-tac-buoc-1.json', JSON.stringify(step1, null, 2) + '\n');
fs.writeFileSync(out + '/quy-tac-buoc-2.json', JSON.stringify(step2, null, 2) + '\n');
console.log('ok');
