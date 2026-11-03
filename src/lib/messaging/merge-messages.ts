import type {PrivateMessage} from './types';
/** Reconcile by server/client ID, never by equal bodies; preserve history on refresh. */
export function mergeMessages(current:PrivateMessage[],incoming:PrivateMessage[]):PrivateMessage[]{
 let merged=[...current];for(const row of incoming){const index=merged.findIndex(m=>m.id===row.id||(row.clientMessageId&&m.clientMessageId===row.clientMessageId&&m.senderId===row.senderId));if(index>=0)merged[index]={...merged[index],...row,failedToSend:row.failedToSend===true,isOptimistic:row.isOptimistic===true,readAt:row.readAt||merged[index].readAt,deliveredAt:row.deliveredAt||merged[index].deliveredAt};else merged.push(row);}
 return merged.sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt));
}

/** Closed conversations are terminal, even if an older refresh completes late. */
export function mergeConversations<T extends {id:string;status:string}>(current:T[],incoming:T[]):T[]{
 const closed=new Set(current.filter(row=>row.status==='closed').map(row=>row.id));
 return incoming.map(row=>closed.has(row.id)&&row.status!=='closed'?{...row,status:'closed'}:row);
}
