import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/config";
export * from "./payment-types";
import type { AdminPaymentItem, AdminPaymentsKPIs, PaymentStatusFilter } from "./payment-types";

function getDemoPaymentsData(): { kpis: AdminPaymentsKPIs; payments: AdminPaymentItem[] } {
  const kpis: AdminPaymentsKPIs = {
    totalValidated: 38000,
    awaitingCount: 2,
    moncashTotal: 22000,
    natcashTotal: 16000,
  };

  const payments: AdminPaymentItem[] = [
    {
      id: "p-wait-2",
      orderId: "ord-wait-2",
      orderReference: "ORD-WAIT-002",
      studentId: "10000000-0000-0000-0000-000000000004",
      studentName: "Jean-Baptiste Dorval",
      studentEmail: "dorval@faroschool.com",
      studentPhone: "+50941445566",
      courseId: "c-anglais",
      courseTitleFr: "Anglais des Affaires pour Professionnels",
      courseTitleHt: "Angle Biznis pou Pwofesyonèl",
      provider: "natcash",
      providerTxnId: "NAT-TX-776622",
      payerPhone: "+50941445566",
      amountHtg: 3800,
      status: "awaiting_validation",
      validatedAt: null,
      validatedBy: null,
      rejectionReason: null,
      createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    },
    {
      id: "p-wait-1",
      orderId: "ord-wait-1",
      orderReference: "ORD-WAIT-001",
      studentId: "10000000-0000-0000-0000-000000000003",
      studentName: "Esther Moïse",
      studentEmail: "esther@faroschool.com",
      studentPhone: "+50940334455",
      courseId: "c-entrepreneuriat",
      courseTitleFr: "Lancer et Gérer son Entreprise en Haïti",
      courseTitleHt: "Lanse epi Jere Biznis Ou an Ayiti",
      provider: "natcash",
      providerTxnId: "NAT-TX-998811",
      payerPhone: "+50940334455",
      amountHtg: 5000,
      status: "awaiting_validation",
      validatedAt: null,
      validatedBy: null,
      rejectionReason: null,
      createdAt: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
    },
    {
      id: "p-val-3",
      orderId: "ord-mc-3",
      orderReference: "ORD-MC-003",
      studentId: "10000000-0000-0000-0000-000000000005",
      studentName: "Wideline Saintil",
      studentEmail: "wideline@faroschool.com",
      studentPhone: "+50938556677",
      courseId: "c-excel",
      courseTitleFr: "Excel pour Entreprise : de Zéro à Avancé",
      courseTitleHt: "Excel pou Biznis : Depi nan Kòmansman rive nan Nivo Avanse",
      provider: "moncash",
      providerTxnId: "TX_MC_1002",
      payerPhone: "+50938556677",
      amountHtg: 4000,
      status: "validated",
      validatedAt: new Date(Date.now() - 1 * 86400 * 1000).toISOString(),
      validatedBy: "00000000-0000-0000-0000-000000000001",
      rejectionReason: null,
      createdAt: new Date(Date.now() - 1 * 86400 * 1000).toISOString(),
    },
  ];

  return { kpis, payments };
}

/**
 * Fetches admin payments KPIs.
 * In production: always queries the database; returns zeros on error or empty.
 * Never silently returns fake stats in production.
 */
export async function getAdminPaymentsKPIs(): Promise<AdminPaymentsKPIs> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_admin_payments_kpis");

    if(error||!data){if(isDemoMode())return getDemoPaymentsData().kpis;const payments=await getAdminPaymentsList();return {totalValidated:payments.filter(p=>p.status==='validated').reduce((n,p)=>n+p.amountHtg,0),awaitingCount:payments.filter(p=>p.status==='awaiting_validation').length,moncashTotal:payments.filter(p=>p.status==='validated'&&p.provider==='moncash').reduce((n,p)=>n+p.amountHtg,0),natcashTotal:payments.filter(p=>p.status==='validated'&&p.provider==='natcash').reduce((n,p)=>n+p.amountHtg,0)};}
    if (!error && data) {
      return {
        totalValidated: Math.round(Number(data.total_validated || 0)),
        awaitingCount: Number(data.awaiting_count || 0),
        moncashTotal: Math.round(Number(data.moncash_total || 0)),
        natcashTotal: Math.round(Number(data.natcash_total || 0)),
      };
    }
  } catch (err) {
    if(!isDemoMode())throw Error("payments_unavailable");
  }

  if (isDemoMode()) {
    return getDemoPaymentsData().kpis;
  }

  return {
    totalValidated: 0,
    awaitingCount: 0,
    moncashTotal: 0,
    natcashTotal: 0,
  };
}

/**
 * Fetches filtered list of payments for admin ledger.
 * In production: always queries real database; returns empty array when no records exist.
 * Never silently returns fake transactions in production.
 */
export async function getAdminPaymentsList(
  status: PaymentStatusFilter = "all",
  search: string = ""
): Promise<AdminPaymentItem[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_admin_payments_list", {
      p_status: status,
      p_search: search,
    });

    if(error||!Array.isArray(data))return await readPaymentLedger(supabase,status,search);
    if (!error && data && Array.isArray(data)) {
      return data.map((p: any) => ({
        id: p.id,
        orderId: p.order_id,
        orderReference: p.order_reference,
        studentId: p.student_id,
        studentName: p.student_name,
        studentEmail: p.student_email,
        studentPhone: p.student_phone,
        courseId: p.course_id,
        courseTitleFr: p.course_title_fr,
        courseTitleHt: p.course_title_ht,
        provider: p.provider,
        providerTxnId: p.provider_txn_id,
        payerPhone: p.payer_phone,
        amountHtg: Math.round(Number(p.amount_htg)),
        status: p.status,
        validatedAt: p.validated_at,
        validatedBy: p.validated_by,
        rejectionReason: p.rejection_reason,
        createdAt: p.created_at,
      }));
    }
  } catch (err) {
    if(!isDemoMode())throw Error("payments_unavailable");
  }

  if (isDemoMode()) {
    const demoPayments = getDemoPaymentsData().payments;
    return demoPayments.filter((p) => {
      const matchesStatus =
        status === "all" ||
        (status === "awaiting_validation" && p.status === "awaiting_validation") ||
        (status === "validated" && p.status === "validated") ||
        (status === "failed" && (p.status === "failed" || (p.status as any) === "cancelled"));

      const s = search.toLowerCase();
      const matchesSearch =
        !s ||
        p.studentName.toLowerCase().includes(s) ||
        p.studentPhone.toLowerCase().includes(s) ||
        p.providerTxnId.toLowerCase().includes(s) ||
        p.orderReference.toLowerCase().includes(s) ||
        p.courseTitleFr.toLowerCase().includes(s);

      return matchesStatus && matchesSearch;
    });
  }

  return [];
}

async function readPaymentLedger(db:Awaited<ReturnType<typeof createClient>>,status:string,search:string):Promise<AdminPaymentItem[]>{
 const {data,error}=await db.from('payments').select('id,order_id,provider,provider_txn_id,payer_phone,status,validated_at,validated_by,rejection_reason,created_at,orders!inner(id,user_id,course_id,reference,amount_htg,profiles!user_id(id,full_name,email,phone),courses(id,title_fr,title_ht))').order('created_at',{ascending:false});
 if(error||!data)throw Error('payments_unavailable');
 return(data as any[]).map(p=>{const o=p.orders,student=o.profiles||{},course=o.courses||{};return{id:p.id,orderId:o.id,orderReference:o.reference,studentId:o.user_id,studentName:student.full_name||'Apprenant',studentEmail:student.email||'',studentPhone:student.phone||p.payer_phone||'',courseId:o.course_id,courseTitleFr:course.title_fr||'',courseTitleHt:course.title_ht||'',provider:p.provider,providerTxnId:p.provider_txn_id||'',payerPhone:p.payer_phone||'',amountHtg:Number(o.amount_htg),status:p.status,validatedAt:p.validated_at,validatedBy:p.validated_by,rejectionReason:p.rejection_reason,createdAt:p.created_at};}).filter(p=>(status==='all'||p.status===status||(status==='failed'&&(p.status as string)==='cancelled'))&&(!search||[p.studentName,p.studentEmail,p.studentPhone,p.providerTxnId,p.orderReference,p.courseTitleFr,p.courseTitleHt].some(value=>value.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))));
}
