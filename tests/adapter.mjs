import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export function sqliteAdapter(file=':memory:') {
 const raw=new DatabaseSync(file);
 raw.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
 function prepare(sql) {
  return {
   bind(...args) {
    const statement=raw.prepare(sql);
    const execute=()=>({meta:{changes:Number(statement.run(...args).changes)}});
    return {
     async all(){return {results:statement.all(...args)};},
     async first(){return statement.get(...args)||null;},
     async run(){return execute();},
     _run:execute
    };
   }
  };
 }
 return {raw,prepare,async batch(statements){raw.exec('BEGIN IMMEDIATE');try{const result=statements.map(s=>s._run());raw.exec('COMMIT');return result;}catch(e){raw.exec('ROLLBACK');throw e;}}};
}
export function memoryBucket(){const data=new Map();return {data,async put(key,bytes){data.set(key,new Uint8Array(bytes));},async delete(key){data.delete(key);},async get(key){const b=data.get(key);return b?{body:b,async arrayBuffer(){return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}}:null;}};}
export function applyMigrations(db,dir){if(dir instanceof URL)dir=fileURLToPath(dir);for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.sql')).sort())db.raw.exec(fs.readFileSync(path.join(dir,f),'utf8'));}

