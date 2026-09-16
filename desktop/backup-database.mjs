import {DatabaseSync,backup} from 'node:sqlite';
const [source,destination]=process.argv.slice(2);
if(!source||!destination)throw new Error('Missing database paths');
const db=new DatabaseSync(source,{readOnly:true});
try{await backup(db,destination);}finally{db.close();}
