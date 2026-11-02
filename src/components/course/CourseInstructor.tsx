import {useTranslations} from 'next-intl';
import type {PublicAuthor} from '@/lib/public-course-facts';
export function CourseInstructor({instructor}:{instructor:PublicAuthor|null}){
 const t=useTranslations('courseDetail.instructor'),facts=useTranslations('courseFacts');
 return <div className="rounded-[18px] border border-line bg-surface p-6 sm:p-8 space-y-4 shadow-card">
  <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-ink">{t('title')}</h2>
  {instructor ? <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 pt-2">
   {/* eslint-disable-next-line @next/next/no-img-element */}
   {instructor.avatarUrl ? <img src={instructor.avatarUrl} alt={instructor.fullName} width={80} height={80} className="h-20 w-20 rounded-full object-cover border border-line"/> : <div aria-hidden className="h-20 w-20 rounded-full bg-orange-tint text-orange flex items-center justify-center text-xl font-bold">{instructor.fullName.charAt(0)}</div>}
   <div className="space-y-2 text-center sm:text-left"><h3 className="font-heading text-lg font-bold text-ink">{instructor.fullName}</h3>
   {instructor.title && <p className="text-sm text-muted-faro">{instructor.title}</p>}
   {instructor.bio && <p className="text-sm text-muted-faro whitespace-pre-line break-words">{instructor.bio}</p>}</div>
  </div> : <p className="text-sm text-muted-faro">{facts('unknownAuthor')}</p>}
 </div>;
}
