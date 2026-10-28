-- Migration: Add composite indexes for course catalog filtering, sorting and status
-- Enables high-performance server-side querying on published courses for low-latency edge delivery

CREATE INDEX IF NOT EXISTS idx_courses_status_category ON public.courses(status, category);
CREATE INDEX IF NOT EXISTS idx_courses_status_level ON public.courses(status, level);
CREATE INDEX IF NOT EXISTS idx_courses_status_price ON public.courses(status, price_htg);
CREATE INDEX IF NOT EXISTS idx_courses_status_created ON public.courses(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_courses_search_titles ON public.courses USING btree (title_fr, title_ht);
