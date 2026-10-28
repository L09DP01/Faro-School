import { Container } from "@/components";

export default function CatalogLoading() {
  return (
    <div className="py-8 md:py-12 animate-pulse">
      <Container className="space-y-8">
        <div className="space-y-3 max-w-xl">
          <div className="h-8 w-2/3 bg-muted rounded-lg" />
          <div className="h-4 w-full bg-muted rounded" />
          <div className="h-10 w-full bg-muted rounded-lg" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="hidden lg:block lg:col-span-1 h-96 bg-muted rounded-xl" />
          <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-72 rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="h-36 bg-muted rounded-md" />
                <div className="h-4 w-3/4 bg-muted rounded" />
                <div className="h-3 w-1/2 bg-muted rounded" />
              </div>
            ))}
          </div>
        </div>
      </Container>
    </div>
  );
}
