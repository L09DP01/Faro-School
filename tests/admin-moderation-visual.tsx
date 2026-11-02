import React from 'react';
import {createRoot} from 'react-dom/client';
import {AdminModerationClient} from '../src/components/admin/moderation/AdminModerationClient';
import {AdminMessagingSupervisionClient} from '../src/components/admin/supervision/AdminMessagingSupervisionClient';

const query=new URLSearchParams(location.search),locale=query.get('locale')||'fr';
const supervision=query.has('supervision');
createRoot(document.getElementById('root')!).render(<main className="bg-bg min-h-screen p-4 sm:p-8">
  {supervision ? <AdminMessagingSupervisionClient locale={locale} currentAdminId="admin" aiConfigured
    students={[]} breakGlassLogs={[]} initialSettings={{defaultModel:'gemini-2.5-flash',defaultConfidenceThreshold:.75,dailyCostCapUsd:5,studentDailyLimit:30,killSwitch:false}}
    initialStats={{period:'7d',totalConversations:1,activeConversations:1,medianResponseTimeMinutes:1,aiResolutionRatePercent:0,escalationsCount:3,reviensPlusTardCount:0,aiCostPerDayUsd:.00007042857142857,totalTokensUsed:10}}
    conversations={[{id:'thread',studentId:'student',studentName:'Élève de démonstration',staffId:'admin',staffName:'Administration',staffRole:'admin',subject:'Contacter la direction',status:'waiting_staff',createdAt:'2026-10-31T12:00:00Z',lastMessageAt:'2026-10-31T12:00:00Z'}]}/>
    : <AdminModerationClient locale={locale} initialReports={[]} initialMuted={[]} initialBanned={[]} initialWordFilters={{fr:[],ht:[]}} initialRules={{fr:'Règles de test',ht:'Règ pou tès'}} initialFlags={[]} auditLogs={[]} unavailableSections={query.has('failed')?['sanctions']:[]}/>}
</main>);
