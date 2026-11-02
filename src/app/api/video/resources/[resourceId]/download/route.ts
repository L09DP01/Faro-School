import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BunnyStorage } from "@/lib/video/bunny-storage";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ resourceId: string }> }
) {
  try {
    const { resourceId } = await params;
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const supabase = await createClient();

    // 1. Fetch resource and find associated course
    const { data: resource, error } = await supabase
      .from("lesson_resources")
      .select(`
        id,
        name,
        file_url,
        lesson_id,
        lessons!inner (
          modules!inner (
            course_id
          )
        )
      `)
      .eq("id", resourceId)
      .maybeSingle();

    if (error || !resource) {
      return NextResponse.json({ error: "Ressource introuvable" }, { status: 404 });
    }

    const courseId = (resource.lessons as any)?.modules?.course_id;

    // 2. Check enrollment or admin role
    const {data:course}=await supabase.from('courses').select('instructor_id').eq('id',courseId).single();
    const ownCourse=user.role==='instructor'&&course?.instructor_id===user.id;
    if (user.role !== "admin" && !ownCourse) {
      const { data: enrollment } = await supabase
        .from("enrollments")
        .select("id")
        .eq("user_id", user.id)
        .eq("course_id", courseId)
        .is("revoked_at",null)
        .maybeSingle();

      if (!enrollment) {
        return NextResponse.json(
          { error: "Accès refusé : vous devez être inscrit pour télécharger cette ressource." },
          { status: 403 }
        );
      }
    }

    // 3. Generate signed URL or redirect
    const storage = new BunnyStorage();
    const signedUrl = await storage.getSignedResourceUrl(
      resource.file_url,
      user.id,
      courseId
    );

    return NextResponse.redirect(signedUrl,{status:307,headers:{"Cache-Control":"no-store"}});
  } catch (err: any) {
    return NextResponse.json(
      { error: "Téléchargement impossible", message: err?.message },
      { status: 500 }
    );
  }
}
