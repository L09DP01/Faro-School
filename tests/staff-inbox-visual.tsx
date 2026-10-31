/** Local-only visual fixture. No production route, account, provider or database. */
import React from 'react';
import {createRoot} from 'react-dom/client';
import {NextIntlClientProvider} from 'next-intl';
import {AdminLayoutClient} from '../src/components/admin/AdminLayoutClient';
import {InstructorMessagesClient} from '../src/components/admin/messages/InstructorMessagesClient';
import {PwaViewport} from '../src/components/pwa/PwaViewport';
import fr from '../src/messages/fr.json';
import ht from '../src/messages/ht.json';
const language=new URLSearchParams(location.search).get('locale')==='ht'?'ht':'fr';
const conversations=Array.from({length:32},(_,i)=>({id:'conversation-'+i,studentId:'student-'+i,studentName:i===0?'Jan-Pòl Étienne':`Élève exemple ${i+1}`,staffId:'admin-test',staffName:'Support Faro School',staffRole:'admin',courseId:null,courseTitle:'Support technique',subject:'Demande d’assistance',status:'open',createdAt:'2026-10-31T12:00:00Z',lastMessageAt:'2026-10-31T12:00:00Z',unreadCount:0}));
const messages=Array.from({length:65},(_,i)=>({id:'message-'+i,conversationId:'conversation-0',senderType:i%2?'staff':'student',senderName:i%2?'Support Faro School':'Jan-Pòl Étienne',body:i===64?'Dernier message de la conversation — entièrement visible.':`Message de démonstration ${i+1}. ${i%2?'Voici les étapes pour résoudre votre problème.':'Je souhaite une précision sur le fonctionnement de mon espace.'}`,createdAt:'2026-10-31T12:00:00Z',meta:{}}));
(window as any).__inboxFixture={conversations,messages};
window.fetch=async()=>Response.json({community:0,messages:0});
createRoot(document.getElementById('root')!).render(<NextIntlClientProvider locale={language} messages={language==='ht'?ht:fr}><PwaViewport/><AdminLayoutClient locale={language} admin={{id:'admin-test',email:'fixture@example.test',fullName:'Équipe Faro School',role:'admin',locale:language} as any}><div className="admin-inbox-page flex flex-col flex-1 min-h-0 min-w-0 gap-3 sm:gap-4 overflow-hidden"><div className="admin-inbox-tabs shrink-0 flex gap-2 overflow-x-auto no-scrollbar border-b border-line pb-2"><button className="px-4 py-2 text-xs rounded-xl bg-ink text-surface">{language==='ht'?'Sipò teknik ak kou mwen yo':'Support technique et mes cours'}</button><button className="px-4 py-2 text-xs rounded-xl border border-line">{language==='ht'?'Fòm kontak piblik':'Formulaire de contact public'}</button></div><InstructorMessagesClient initialConversations={conversations as any} initialActiveId="conversation-0" enrolledStudents={[]} instructorCourses={[]} currentUserId="admin-test" currentUserName="Équipe Faro School" currentUserRole="admin" locale={language}/></div></AdminLayoutClient></NextIntlClientProvider>);
