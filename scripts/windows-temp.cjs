// Some restricted Windows accounts cannot query the OS account database.
// tsx uses userInfo only to name a temporary directory. Supply a non-secret
// deterministic name when this OS call is unavailable; no permission change.
const os=require('node:os');
try{os.userInfo();}catch{os.userInfo=()=>({username:'talal-lab-build',uid:-1,gid:-1,homedir:os.tmpdir(),shell:null});}

