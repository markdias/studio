import { Landmark } from "lucide-react";
import TaxCalculator from "@/components/tax-calculator";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="py-6 border-b">
        <div className="container mx-auto flex items-center gap-3 px-4">
          <Landmark className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold font-headline text-primary">
            TaxWise UK
          </h1>
        </div>
      </header>
      <main className="flex-grow container mx-auto p-4 md:p-8">
        <TaxCalculator />
      </main>
      <footer className="py-4 border-t">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} TaxWise UK. For estimation purposes only.</p>
        </div>
      </footer>
    </div>
  );
}
