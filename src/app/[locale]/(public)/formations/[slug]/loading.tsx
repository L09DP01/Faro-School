import { Container } from "@/components";

export default function CourseDetailLoading() {
  return (
    <div className="py-8 md:py-12 animate-pulse space-y-8">
      {/* Hero Skeleton */}
      <div className="border-b border-border bg-muted/30 py-8">
        <Container className="space-y-4 max-w-3xl">
          <div className="h-4 w-1/4 bg-muted rounded" />
          <div className="h-10 w-3/4 bg-muted rounded-lg" />
          <div className="h-4 w-full bg-muted rounded" />
          <div className="h-4 w-2/3 bg-muted rounded" />
        </Container>
      </div>

      {/* Grid Skeleton */}
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="h-48 bg-muted rounded-xl" />
            <div className="h-64 bg-muted rounded-xl" />
            <div className="h-40 bg-muted rounded-xl" />
          </div>
          <div className="lg:col-span-1">
            <div className="h-96 bg-muted rounded-xl" />
          </div>
        </div>
      </Container>
    </div>
  );
}
