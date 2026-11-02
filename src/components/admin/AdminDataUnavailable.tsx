"use client";
export function AdminDataUnavailable({locale}:{locale:string}){
 const ht=locale==='ht';
 return <section role="alert" className="rounded-2xl border border-line bg-surface p-6 space-y-3"><h1 className="font-heading font-bold text-xl text-ink">{ht?'Done yo pa disponib pou kounye a':'Chargement des données indisponible'}</h1><p className="text-sm text-muted-faro">{ht?'Nou pa kapab li done yo. Sa pa vle di lis la vid. Eseye rechaje paj la.':'La lecture des données a échoué. Cela ne signifie pas que la liste est vide. Rechargez la page pour réessayer.'}</p><button type="button" onClick={()=>window.location.reload()} className="inline-flex min-h-11 items-center px-4 rounded-xl bg-orange text-white font-semibold">{ht?'Rechaje paj la':'Recharger la page'}</button></section>;
}
