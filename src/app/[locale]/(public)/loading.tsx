import { Container } from "@/components";

export default function Loading() {
  return (
    <div className="py-12 animate-pulse">
      <Container className="space-y-8">
        <div className="h-10 w-2/3 max-w-md bg-muted rounded-lg mx-auto" />
        <div className="h-5 w-1/2 max-w-sm bg-muted rounded mx-auto" />
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 pt-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-72 rounded-lg border border-border bg-card p-4 space-y-4">
              <div className="h-36 bg-muted rounded-md" />
              <div className="h-4 w-3/4 bg-muted rounded" />
              <div className="h-3 w-1/2 bg-muted rounded" />
            </div>
          ))}
        </div>
      </Container>
    </div>
  );
}
