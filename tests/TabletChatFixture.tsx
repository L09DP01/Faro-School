import React,{useState} from 'react';
import {StudentStaffChatView} from '../src/components/messaging/StudentStaffChatView';
import {CommunityChatView} from '../src/components/community/CommunityChatView';
export function TabletChatFixture({community,locale}:{community:boolean;locale:string}){
 const [selected,setSelected]=useState(false);
 const conversation:any={id:'local-thread',studentId:'student',studentName:'Local student',staffId:'teacher',staffName:'Local teacher',staffRole:'instructor',courseId:'course',courseTitle:'Local course',subject:'Local conversation',status:'ai_handling',createdAt:'2026-11-02T00:00:00Z',lastMessageAt:'2026-11-02T00:00:00Z'};
 return <div style={{height:"100dvh"}} className="flex min-w-0 bg-bg"><aside data-testid="app-sidebar" className="hidden md:flex w-[285px] shrink-0 bg-navy-deep text-white p-4">Faro School</aside><main className="min-w-0 flex-1 p-6 h-full" onClick={e=>{const link=(e.target as Element).closest('a');if(link?.getAttribute('href')?.includes('/dashboard/messages')){e.preventDefault();setSelected(link.getAttribute('href')?.endsWith('/local-thread')||false);}}}>
 {community?<CommunityChatView initialMessages={[]} initialPinnedMessage={null} members={[]} currentUser={{id:'student',fullName:'Local student',email:null,role:'student'}} hasAcceptedRules={true} locale={locale} groupInfo={{id:'group',name:'Communauté Faro School',description:'',totalMembersCount:0,onlineCount:0,lastMessageSnippet:'',lastMessageTime:'',unreadCount:0}}/>:<StudentStaffChatView conversations={[conversation]} activeConversation={selected?conversation:null} initialMessages={[]} currentUserId="student" currentUserRole="student" currentUserName="Local student" enrolledCourses={[]} locale={locale}/>}
 </main></div>;
}
