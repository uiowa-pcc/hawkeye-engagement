import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker,{contactInput,interactionInput} from '../worker/index.js';
test('unconfigured deployment denies data and static assets', async()=>{
 for (const path of ['/api/data','/']) assert.equal((await worker.fetch(new Request('https://example.workers.dev'+path),{})).status,401);
});
test('local bypass does not unlock a deployed host',async()=>{
 assert.equal((await worker.fetch(new Request('https://example.workers.dev/api/data'),{LOCAL_DEV:'true'})).status,401);
});
test('normalizes contact and rejects invalid values',()=>{
 assert.equal(contactInput({name:' Jane ',email:'Jane@UIOWA.EDU',department:' Biology '}).email,'jane@uiowa.edu');
 assert.throws(()=>contactInput({name:'Jane',email:'bad',department:'Biology'}));
});
test('checks calendar dates',()=>{
 const row={contact_id:'1',interaction_date:'2026-02-30',service:'Other',description:'Meeting',staff_member:''};
 assert.throws(()=>interactionInput(row));
 assert.equal(interactionInput({...row,interaction_date:'2026-02-28'}).interaction_date,'2026-02-28');
});
test('blocks cross origin writes',async()=>{
 const result=await worker.fetch(new Request('http://localhost/api/contacts',{method:'POST',headers:{Origin:'https://elsewhere.com','Content-Type':'application/json'},body:'{}'}),{LOCAL_DEV:'true'});
 assert.equal(result.status,403);
});
